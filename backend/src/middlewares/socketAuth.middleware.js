import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import cookie from 'cookie';

export const requireSocketAuth = (socket, next) => {
  try {
    const cookieHeader = socket.handshake.headers.cookie;
    if (!cookieHeader) {
      return next(new Error('Authentification requise : Aucun cookie trouvé'));
    }

    const cookies = cookie.parse(cookieHeader);
    const token = cookies.accessToken;

    if (!token) {
      return next(new Error('Authentification requise : Token manquant'));
    }

    const decoded = jwt.verify(token, env.JWT_SECRET);
    socket.user = decoded; // { sub: userId, type: 'access', ... }
    
    next();
  } catch (err) {
    return next(new Error('Authentification échouée : Token invalide ou expiré'));
  }
};
