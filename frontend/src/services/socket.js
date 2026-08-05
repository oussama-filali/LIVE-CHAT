import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

let socket = null;

// Singleton : une seule connexion socket pour toute l'app.
// withCredentials: true envoie le cookie accessToken, lu côté serveur
// par le middleware d'auth dans sockets/chat.js
export function getSocket() {
  if (!socket) {
    socket = io(`${SOCKET_URL}/chat`, {
      withCredentials: true,
      autoConnect: false,
      transports: ['websocket'], // Favoriser WebSocket
    });
  }
  return socket;
}
