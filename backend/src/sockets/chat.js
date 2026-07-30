import { socketAuthMiddleware } from '../middlewares/socketAuth.middleware.js';

export const setupChatSocket = (io) => {
  const chatNamespace = io.of('/chat');

  // Middleware d'authentification Socket fait
  chatNamespace.use(socketAuthMiddleware);
  chatNamespace.on('connection', (socket) => {
    console.log(`[Chat] Utilisateur connecté : ${socket.id}`);

    socket.on('join-channel', (channelId) => {
      socket.join(channelId);
      console.log(`[Chat] ${socket.id} a rejoint ${channelId}`);
    });

    socket.on('send-message', (data) => {
      // TODO: Insérer dans MongoDB via repository
      // Émettre ensuite à la room (channelId)
    });

    socket.on('disconnect', () => {
      console.log(`[Chat] Utilisateur déconnecté : ${socket.id}`);
      // TODO: Maj statut dans Redis
    });
  });
};