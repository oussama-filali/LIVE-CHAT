import { requireSocketAuth } from '../middlewares/socketAuth.middleware.js';
import { setUserVoiceSocket, removeUserVoiceSocket, pingPresence } from '../services/presence.service.js';

export const setupWebRTCSocket = (io) => {
  const voiceNamespace = io.of('/voice');
  // On a besoin du namespace chat pour diffuser le changement de statut globalement
  const chatNamespace = io.of('/chat'); 

  // Authentifier le namespace
  voiceNamespace.use(requireSocketAuth);

  voiceNamespace.on('connection', (socket) => {
    const userId = socket.user.sub;
    console.log(`[Voice] Utilisateur connecté : ${userId}`);

    socket.on('join-voice-channel', async (data) => {
      const { channelId, serverId } = data; // Le client doit fournir le serverId
      socket.join(channelId);
      
      // On sauvegarde le serverId dans l'état du socket pour pouvoir broadcast à sa déconnexion
      socket.data.serverId = serverId; 

      // Notifier les membres du canal vocal
      socket.to(channelId).emit('user-joined-voice', { userId });

      // --- 3. Mise à jour de la Présence (Occupé) ---
      // L'utilisateur vient de rejoindre un vocal, il passe en statut "busy" (occupé)
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
        signalData: data.signalData
      });
    });

    // Quand l'utilisateur quitte volontairement le salon vocal
    socket.on('leave-voice-channel', async () => {
      // --- Mise à jour de la Présence (En Ligne) ---
      // Retire ce socket vocal. S'il a encore son onglet de chat ouvert, il repassera en 'online'
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
      
      const presence = await removeUserVoiceSocket(userId, socket.id);
      if (presence.changed && socket.data.serverId) {
         chatNamespace.to(`server:${socket.data.serverId}`).emit('presence-update', { userId, status: presence.status });
      }
    });
  });
};
