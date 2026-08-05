import { Message } from '../modules/messages/message.model.js';
import { PrivateMessage } from '../modules/messages/privateMessage.model.js';
import { requireSocketAuth } from '../middlewares/socketAuth.middleware.js';
import { setUserChatSocket, removeUserChatSocket, pingPresence } from '../services/presence.service.js';
import { prisma } from '../config/postgres.js';

export const setupChatSocket = (io) => {
  const chatNamespace = io.of('/chat');

  // Authentifier le namespace avec le middleware qu'on a créé
  chatNamespace.use(requireSocketAuth);

  // Présence locale par salon (duplication de l'existant de l'ami pour compatibilité)
  const presenceByChannel = new Map();

  const broadcastPresence = (channelId) => {
    const users = Array.from(presenceByChannel.get(channelId)?.values() || []);
    chatNamespace.to(channelId).emit('presence-update', { channelId, users });
  };

  chatNamespace.on('connection', async (socket) => {
    const userId = socket.user.sub;

    // Récupérer le pseudo de l'utilisateur pour compatibilité avec le code de l'ami
    let username = 'Inconnu';
    try {
      const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { username: true }
      });
      if (dbUser) {
        username = dbUser.username;
      }
    } catch (err) {
      console.error('[Chat] Erreur récupération pseudo', err);
    }

    socket.userId = userId;
    socket.username = username;

    console.log(`[Chat] Utilisateur connecté : ${userId} (Socket: ${socket.id}, Pseudo: ${username})`);

    // Rejoindre la room personnelle unique pour les messages privés
    socket.join(`user:${userId}`);

    // --- 1. Rejoindre les Rooms des serveurs pour le Broadcast (Scalabilité) ---
    try {
      const memberships = await prisma.membership.findMany({ where: { userId } });
      memberships.forEach(m => {
        socket.join(`server:${m.serverId}`);
      });
    } catch (err) {
      console.error('[Chat] Erreur récupération memberships pour Socket', err);
    }

    // --- 2. Mise à jour de la Présence globale (En Ligne) ---
    const presence = await setUserChatSocket(userId, socket.id);
    
    if (presence.error === 'MAX_TABS_REACHED') {
      console.log(`[Chat] Rejet : Limite d'onglets atteinte pour ${userId}`);
      socket.emit('error', { message: 'Vous avez atteint la limite de 2 onglets ouverts simultanément.' });
      socket.disconnect();
      return;
    }

    if (presence.changed) {
      // Diffuser le changement de statut (il vient de passer en ligne)
      socket.rooms.forEach(room => {
        if (room.startsWith('server:')) {
          chatNamespace.to(room).emit('presence-update', { userId, status: presence.status });
        }
      });
    }

    // Rejoindre un salon spécifique
    socket.on('join-channel', (channelId) => {
      if (!channelId) return;

      socket.join(channelId);
      socket.data.channelId = channelId;

      if (!presenceByChannel.has(channelId)) {
        presenceByChannel.set(channelId, new Map());
      }
      presenceByChannel.get(channelId).set(socket.id, {
        userId: socket.userId,
        username: socket.username,
      });

      broadcastPresence(channelId);
      console.log(`[Chat] ${socket.username} a rejoint ${channelId}`);
    });

    // Quitter un salon spécifique
    socket.on('leave-channel', (channelId) => {
      if (!channelId) return;

      socket.leave(channelId);
      presenceByChannel.get(channelId)?.delete(socket.id);
      broadcastPresence(channelId);
      console.log(`[Chat] ${socket.username} a quitté ${channelId}`);
    });

    // Sauvegarde + Diffusion du message du salon public
    socket.on('send-message', async ({ channelId, content }) => {
      if (!channelId || !content?.trim()) return;

      try {
        const newMessage = await Message.create({
          channelId,
          senderId: socket.userId,
          senderName: socket.username,
          content: content.trim(),
        });

        // Diffusion à toute la room du salon
        chatNamespace.to(channelId).emit('receive-message', newMessage);
      } catch (error) {
        console.error('[Chat] Erreur enregistrement message :', error);
        socket.emit('error-message', { error: "Échec de l'envoi du message" });
      }
    });

    // Gérer l'envoi de messages privés
    const handleSendPrivateMessage = async (data) => {
      const { conversationId, recipientId, content } = data;

      if (!conversationId || !recipientId || !content) {
        socket.emit('error-message', { error: 'Données insuffisantes pour envoyer le message privé' });
        return;
      }

      try {
        const newMessage = await PrivateMessage.create({
          conversationId,
          senderId: userId,
          senderName: username,
          content
        });

        // Réactiver la visibilité de la conversation pour les deux participants
        await prisma.conversationParticipant.updateMany({
          where: {
            conversationId,
            userId: { in: [userId, recipientId] }
          },
          data: {
            isVisible: true
          }
        });

        // Diffuser le message aux deux participants via leurs rooms personnelles
        chatNamespace.to(`user:${userId}`).emit('receive_private_message', newMessage);
        chatNamespace.to(`user:${recipientId}`).emit('receive_private_message', newMessage);
      } catch (error) {
        console.error('[Chat] Erreur envoi message privé :', error);
        socket.emit('error-message', { error: 'Échec de l\'envoi du message privé' });
      }
    };

    socket.on('send_private_message', handleSendPrivateMessage);
    socket.on('send-private-message', handleSendPrivateMessage);

    // Gérer l'état de saisie (typing)
    socket.on('typing', (data) => {
      const { conversationId, recipientId } = data;
      if (conversationId && recipientId) {
        chatNamespace.to(`user:${recipientId}`).emit('user_typing', { conversationId, userId });
      }
    });

    // Gérer l'arrêt de la saisie (stop_typing)
    socket.on('stop_typing', (data) => {
      const { conversationId, recipientId } = data;
      if (conversationId && recipientId) {
        chatNamespace.to(`user:${recipientId}`).emit('user_stop_typing', { conversationId, userId });
      }
    });

    // Maintien de la connexion active
    socket.on('ping', async () => {
      await pingPresence(userId);
    });

    // L'événement `disconnecting` se lance juste AVANT la déconnexion
    socket.on('disconnecting', async () => {
      const roomsToNotify = Array.from(socket.rooms).filter(r => r.startsWith('server:'));
      
      const presence = await removeUserChatSocket(userId, socket.id);
      
      if (presence.changed) {
        roomsToNotify.forEach(room => {
          chatNamespace.to(room).emit('presence-update', { userId, status: presence.status });
        });
      }
    });

    socket.on('disconnect', () => {
      const channelId = socket.data.channelId;
      if (channelId) {
        presenceByChannel.get(channelId)?.delete(socket.id);
        broadcastPresence(channelId);
      }
      console.log(`[Chat] Utilisateur déconnecté : ${userId} (Socket: ${socket.id})`);
    });
  });
};
