import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export const getSocket = () => {
  return io(`${SOCKET_URL}/chat`, {
    withCredentials: true,
    autoConnect: false, // On se connectera manuellement après l'authentification
    transports: ['websocket'], // Favoriser WebSocket
  });
};
