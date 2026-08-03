import  {parse} from 'cookie';
import { verifyAccessToken } from '../modules/auth/auth.service.js';


export const requireSocketAuth = (socket, next) => {
  try {
    const cookieHeader = socket.handshake.headers.cookie;
    if (!cookieHeader) {
      return next(new Error('Authentification requise : Aucun cookie trouvé'));
    }

    const cookies = parse(cookieHeader);
    const token = cookies.accessToken;

    if (!token) {
      return next(new Error('Authentification requise : Token manquant'));
    }

// Vérification du token JWT
    const decoded = verifyAccessToken(token);
    socket.user = decoded; // { sub: userId, type: 'access', ... }

    next();
  } catch (err) {
    return next(new Error('Authentification échouée : Token invalide ou expiré'));
  }
};
