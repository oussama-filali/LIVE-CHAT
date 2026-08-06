import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const requireSocketAuth = (socket, next) => {
  // Lecture du token transmis via l'handshake Socket.IO ou les cookies
  const token = socket.handshake.auth?.token || socket.handshake.headers?.cookie
    ?.split('; ')
    .find((row) => row.startsWith('accessToken='))
    ?.split('=')[1];

  if (!token) {
    return next(new Error('Accès non autorisé. Token manquant.'));
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    socket.user = decoded; // Attache l'utilisateur au socket
    next();
  } catch (err) {
    next(new Error('Token invalide ou expiré.'));
  }
};