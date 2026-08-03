import { Message } from '../modules/messages/message.model.js';
import { requireSocketAuth } from '../middlewares/socketAuth.middleware.js';
import { setUserChatSocket, removeUserChatSocket, pingPresence } from '../services/presence.service.js';
import { prisma } from '../config/postgres.js';

export const setupChatSocket = (io) => {
  const chatNamespace = io.of('/chat');

  // Authentifier le namespace avec le middleware qu'on vient de créer
  chatNamespace.use(requireSocketAuth);

  chatNamespace.on('connection', async (socket) => {
    const userId = socket.user.sub;
    console.log(`[Chat] Utilisateur connecté : ${userId} (Socket: ${socket.id})`);

    // --- 1. Rejoindre les Rooms des serveurs pour le Broadcast (Scalabilité) ---
    // Plutôt que d'émettre à tout le monde, l'utilisateur rejoint des rooms
    // correspondant à ses serveurs. Ainsi, il recevra la présence de ses amis,
    // et diffusera sa présence uniquement à ses amis.
    try {
      const memberships = await prisma.membership.findMany({ where: { userId } });
      memberships.forEach(m => {
        socket.join(`server:${m.serverId}`);
      });
    } catch (err) {
      console.error('[Chat] Erreur récupération memberships pour Socket', err);
    }

    // --- 2. Mise à jour de la Présence (En Ligne) ---
    const presence = await setUserChatSocket(userId, socket.id);
    
    if (presence.error === 'MAX_TABS_REACHED') {
      console.log(`[Chat] Rejet : Limite d'onglets atteinte pour ${userId}`);
      socket.emit('error', { message: 'Vous avez atteint la limite de 2 onglets ouverts simultanément.' });
      socket.disconnect();
      return;
    }

    if (presence.changed) {
      // Diffuser le changement de statut (il vient de passer en ligne)
      // On diffuse uniquement aux rooms "server:xxx" auxquelles il appartient
      socket.rooms.forEach(room => {
        if (room.startsWith('server:')) {
          chatNamespace.to(room).emit('presence-update', { userId, status: presence.status });
        }
      });
    }

    // Rejoindre un salon spécifique
    socket.on('join-channel', (channelId) => {
      socket.join(channelId);
      console.log(`[Chat] ${userId} a rejoint ${channelId}`);
    });

    // Quitter un salon spécifique
    socket.on('leave-channel', (channelId) => {
      socket.leave(channelId);
      console.log(`[Chat] ${userId} a quitté ${channelId}`);
    });

    // Sauvegarde + Diffusion du message
    socket.on('send-message', async (data) => {
      const { channelId, content } = data;
      // Bonne pratique : Prendre l'ID sécurisé depuis le token, pas depuis les data client
      try {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        const newMessage = await Message.create({
          channelId,
          senderId: userId,
          senderName: user?.username || 'Inconnu',
          content
        });

        // Diffusion à toute la room du salon
        chatNamespace.to(channelId).emit('receive-message', newMessage);
      } catch (error) {
        console.error('[Chat] Erreur enregistrement message :', error);
        socket.emit('error-message', { error: 'Échec de l\'envoi du message' });
      }
    });

    // Maintien de la connexion active
    socket.on('ping', async () => {
      await pingPresence(userId);
    });

    // L'événement `disconnecting` se lance juste AVANT la déconnexion
    // Cela permet d'avoir encore accès à `socket.rooms` pour prévenir ses serveurs
    socket.on('disconnecting', async () => {
      const roomsToNotify = Array.from(socket.rooms).filter(r => r.startsWith('server:'));
      
      // --- Mise à jour de la Présence (Absent) ---
      // Retire ce socket. Si c'est son dernier socket ouvert, il passe 'offline'.
      const presence = await removeUserChatSocket(userId, socket.id);
      
      if (presence.changed) {
        roomsToNotify.forEach(room => {
          chatNamespace.to(room).emit('presence-update', { userId, status: presence.status });
        });
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Chat] Utilisateur déconnecté : ${userId} (Socket: ${socket.id})`);
    });
  });
};
