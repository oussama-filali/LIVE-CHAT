export const setupWebRTCSocket = (io) => {
  const voiceNamespace = io.of('/voice');

  voiceNamespace.on('connection', (socket) => {
    console.log(`[Voice] Utilisateur connecté : ${socket.id}`);

    socket.on('join-voice-channel', (channelId) => {
      socket.join(channelId);
      // Notifier les membres du canal vocal
      socket.to(channelId).emit('user-joined-voice', { userId: socket.id });
    });

    socket.on('signal', (data) => {
      // Signalisation WebRTC pour peer-to-peer ou SFU
      socket.to(data.targetUserId).emit('signal', {
        senderId: socket.id,
        signalData: data.signalData
      });
    });

    socket.on('disconnect', () => {
      console.log(`[Voice] Utilisateur déconnecté : ${socket.id}`);
    });
  });
};