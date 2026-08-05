import { create } from 'zustand';
import { getSocket } from '../services/socket';
import { getChannelMessagesRequest } from '../services/message.service';

export const useChatStore = create((set, get) => ({
  messagesByChannel: {},
  onlineUsersByChannel: {},
  currentChannelId: null,

  // Connecte la socket et attache les listeners une seule fois
  // (évite les doublons si connect() est appelé plusieurs fois, ex: React StrictMode)
  connect: () => {
    const socket = getSocket();

    if (!socket.__listenersAttached) {
      socket.__listenersAttached = true;

      socket.on('receive-message', (message) => {
        set((state) => ({
          messagesByChannel: {
            ...state.messagesByChannel,
            [message.channelId]: [...(state.messagesByChannel[message.channelId] || []), message],
          },
        }));
      });

      socket.on('presence-update', ({ channelId, users }) => {
        set((state) => ({
          onlineUsersByChannel: { ...state.onlineUsersByChannel, [channelId]: users },
        }));
      });

      socket.on('connect_error', (err) => {
        console.error('[Socket] Erreur de connexion :', err.message);
      });
    }

    if (!socket.connected) {
      socket.connect();
    }
  },

  joinChannel: async (channelId) => {
    if (!channelId) return;

    const socket = getSocket();
    const previous = get().currentChannelId;

    if (previous && previous !== channelId) {
      socket.emit('leave-channel', previous);
    }

    set({ currentChannelId: channelId });
    socket.emit('join-channel', channelId);

    // Charge l'historique une seule fois par salon
    if (!get().messagesByChannel[channelId]) {
      try {
        const history = await getChannelMessagesRequest(channelId);
        set((state) => ({
          messagesByChannel: { ...state.messagesByChannel, [channelId]: history },
        }));
      } catch (err) {
        console.error('Erreur chargement historique:', err);
      }
    }
  },

  sendMessage: (channelId, content) => {
    if (!content?.trim()) return;
    const socket = getSocket();
    socket.emit('send-message', { channelId, content: content.trim() });
  },
}));