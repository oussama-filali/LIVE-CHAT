import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

let voiceSocket = null;

export function getVoiceSocket() {
  if (!voiceSocket) {
    voiceSocket = io(`${SOCKET_URL}/voice`, {
      withCredentials: true,
      autoConnect: false,
    });
  }
  return voiceSocket;
}