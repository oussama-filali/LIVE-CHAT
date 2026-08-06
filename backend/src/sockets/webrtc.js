import { requireSocketAuth } from '../middlewares/socketAuth.middleware.js';
import { setUserVoiceSocket, removeUserVoiceSocket, pingPresence } from '../services/presence.service.js';
import { prisma } from '../config/postgres.js';

export const setupWebRTCSocket = (io) => {
  const voiceNamespace = io.of('/voice');
  // On a besoin du namespace chat pour diffuser le changement de statut globalement
  const chatNamespace = io.of('/chat');

  // Authentifier le namespace
  voiceNamespace.use(requireSocketAuth);

  // AJOUT : présence par salon vocal (channelId -> Map<socketId, { userId, username }>)
  // Nécessaire pour que le nouvel arrivant sache à qui envoyer une offre WebRTC.
  const peersByChannel = new Map();

  voiceNamespace.on('connection', async (socket) => {
    const userId = socket.user.sub;
    console.log(`[Voice] Utilisateur connecté : ${userId}`);

    // AJOUT : récupération du pseudo (même pattern que chat.js) pour l'affichage
    // côté front des participants du salon vocal
    let username = 'Inconnu';
    try {
      const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { username: true },
      });
      if (dbUser) username = dbUser.username;
    } catch (err) {
      console.error('[Voice] Erreur récupération pseudo', err);
    }
    socket.username = username;

    socket.on('join-voice-channel', async (data) => {
      const { channelId, serverId } = data; // Le client doit fournir le serverId

      // AJOUT : envoie au nouvel arrivant la liste des pairs déjà présents
      if (!peersByChannel.has(channelId)) {
        peersByChannel.set(channelId, new Map());
      }
      const room = peersByChannel.get(channelId);
      const existingPeers = Array.from(room.entries()).map(([socketId, info]) => ({
        socketId,
        userId: info.userId,
        username: info.username,
      }));
      socket.emit('voice-peers', existingPeers);

      socket.join(channelId);

      // On sauvegarde le serverId (et le channelId, pour la notif de départ) dans l'état du socket
      socket.data.serverId = serverId;
      socket.data.channelId = channelId; // AJOUT

      room.set(socket.id, { userId, username }); // AJOUT

      // Notifier les membres du canal vocal (AJOUT : socketId + username en plus de userId,
      // nécessaires pour que les pairs existants identifient et affichent le nouvel arrivant)
      socket.to(channelId).emit('user-joined-voice', { socketId: socket.id, userId, username });

      // --- 3. Mise à jour de la Présence (Occupé) ---
      const presence = await setUserVoiceSocket(userId, socket.id);
      if (presence.changed && serverId) {
        chatNamespace.to(`server:${serverId}`).emit('presence-update', { userId, status: presence.status });
      }
    });

    socket.on('signal', (data) => {
      // Signalisation WebRTC pour peer-to-peer
      socket.to(data.targetSocketId).emit('signal', {
        senderSocketId: socket.id,
        senderUserId: userId,
        signalData: data.signalData,
      });
    });

    // Quand l'utilisateur quitte volontairement le salon vocal
    socket.on('leave-voice-channel', async () => {
      // AJOUT : prévenir les autres pairs du salon pour qu'ils ferment leur RTCPeerConnection
      const channelId = socket.data.channelId;
      if (channelId) {
        peersByChannel.get(channelId)?.delete(socket.id);
        socket.to(channelId).emit('user-left-voice', { socketId: socket.id });
      }

      // --- Mise à jour de la Présence (En Ligne) ---
      const presence = await removeUserVoiceSocket(userId, socket.id);
      if (presence.changed && socket.data.serverId) {
        chatNamespace.to(`server:${socket.data.serverId}`).emit('presence-update', { userId, status: presence.status });
      }
    });

    // Maintien de la connexion active
    socket.on('ping', async () => {
      await pingPresence(userId);
    });

    // Quand l'utilisateur ferme violemment son onglet
    socket.on('disconnect', async () => {
      console.log(`[Voice] Utilisateur déconnecté : ${userId}`);

      // AJOUT : même notification de départ que leave-voice-channel
      const channelId = socket.data.channelId;
      if (channelId) {
        peersByChannel.get(channelId)?.delete(socket.id);
        socket.to(channelId).emit('user-left-voice', { socketId: socket.id });
      }

      const presence = await removeUserVoiceSocket(userId, socket.id);
      if (presence.changed && socket.data.serverId) {
        chatNamespace.to(`server:${socket.data.serverId}`).emit('presence-update', { userId, status: presence.status });
      }
    });
  });
};