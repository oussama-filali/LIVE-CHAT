import { Message } from '../modules/messages/message.model.js';

export const setupChatSocket = (io) => {
  const chatNamespace = io.of('/chat');

  chatNamespace.on('connection', (socket) => {
    console.log(`[Chat] Utilisateur connecté : ${socket.id}`);

    // Rejoindre un salon
    socket.on('join-channel', (channelId) => {
      socket.join(channelId);
      console.log(`[Chat] ${socket.id} a rejoint ${channelId}`);
    });

    // Quitter un salon
    socket.on('leave-channel', (channelId) => {
      socket.leave(channelId);
      console.log(`[Chat] ${socket.id} a quitté ${channelId}`);
    });

    // Sauvegarde + Diffusion du message
    socket.on('send-message', async (data) => {
      const { channelId, senderId, senderName, content } = data;

      try {
        const newMessage = await Message.create({
          channelId,
          senderId,
          senderName,
          content
        });

        // Diffusion à toute la room du salon
        chatNamespace.to(channelId).emit('receive-message', newMessage);
      } catch (error) {
        console.error('[Chat] Erreur enregistrement message :', error);
        socket.emit('error-message', { error: 'Échec de l\'envoi du message' });
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Chat] Utilisateur déconnecté : ${socket.id}`);
    });
  });
};