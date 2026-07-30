import { verifyAccessToken } from '../modules/auth/auth.service.js';

const parseCookie = (cookieHeader, name) => {
    if (!cookieHeader) return null;
    const match = cookieHeader.split(';').map(cookie => cookie.trim()).find(cookie => cookie.startsWith(`${name}=`));
    return match ? decodeURIComponent(match.split('=')[1]) : null;
};

export const socketAuthMiddleware = (socket, next) => {
    const token = parseCookie(socket.handshake.headers.cookie, 'accessToken');

    if (!token) {
        return next(new Error('Authentication requise'));
    }

    try {
        const decoded = verifyAccessToken(token);
        socket.userId = decoded.sub; // Attache l'ID de l'utilisateur au socket pour une utilisation ultérieure 
        next();
    } catch (err) {
        return next(new Error('Token invalide ou expiré'));
    }
};