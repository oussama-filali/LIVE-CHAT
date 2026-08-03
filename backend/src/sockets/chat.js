import { Message } from '../modules/messages/message.model.js';
import { verifyAccessToken } from '../modules/auth/auth.service.js';
import { prisma } from '../config/postgres.js';

// Parse minimal du header Cookie (évite d'ajouter une dépendance juste pour ça)
function parseCookies(cookieHeader = '') {
  return Object.fromEntries(
    cookieHeader
      .split(';')
      .filter(Boolean)
      .map((pair) => {
        const [key, ...rest] = pair.trim().split('=');
        return [key, decodeURIComponent(rest.join('='))];
      })
  );
}

export const setupChatSocket = (io) => {
  const chatNamespace = io.of('/chat');

  // Middleware d'authentification : exécuté avant tout "connection".
  // Même logique que requireAuth, mais lue depuis le handshake socket
  // (pas de req.cookies disponible ici).
  chatNamespace.use(async (socket, next) => {
    try {
      const cookies = parseCookies(socket.handshake.headers.cookie);
      const token = cookies.accessToken;

      if (!token) {
        return next(new Error('Non authentifié'));
      }

      const decoded = verifyAccessToken(token);

      const user = await prisma.user.findUnique({
        where: { id: decoded.sub },
        select: { id: true, username: true },
      });

      if (!user) {
        return next(new Error('Utilisateur introuvable'));
      }

      // Identité posée par le serveur, jamais par le client ensuite
      socket.userId = user.id;
      socket.username = user.username;
      next();
    } catch (err) {
      next(new Error('Session invalide ou expirée'));
    }
  });

  // Présence : channelId -> Map<socketId, { userId, username }>
  const presenceByChannel = new Map();

  const broadcastPresence = (channelId) => {
    const users = Array.from(presenceByChannel.get(channelId)?.values() || []);
    chatNamespace.to(channelId).emit('presence-update', { channelId, users });
  };

  chatNamespace.on('connection', (socket) => {
    console.log(`[Chat] Utilisateur connecté : ${socket.id} (${socket.username})`);

    // Rejoindre un salon
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

    // Quitter un salon
    socket.on('leave-channel', (channelId) => {
      if (!channelId) return;

      socket.leave(channelId);
      presenceByChannel.get(channelId)?.delete(socket.id);
      broadcastPresence(channelId);
      console.log(`[Chat] ${socket.username} a quitté ${channelId}`);
    });

    // Sauvegarde + Diffusion du message
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

    socket.on('disconnect', () => {
      const channelId = socket.data.channelId;
      if (channelId) {
        presenceByChannel.get(channelId)?.delete(socket.id);
        broadcastPresence(channelId);
      }
      console.log(`[Chat] Utilisateur déconnecté : ${socket.id}`);
    });
  });
};