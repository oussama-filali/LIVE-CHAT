import { create } from 'zustand';
import {
  getUserServersRequest,
  createServerRequest,
  joinServerRequest,
  createChannelRequest,
} from '../services/server.service';

export const useServerStore = create((set, get) => ({
  servers: [], // memberships : [{ role, server: { id, name, channels: [...] } }]
  activeServerId: null,
  activeChannelId: null,
  isLoading: true,
  error: null,

  fetchServers: async () => {
    set({ isLoading: true, error: null });
    try {
      const memberships = await getUserServersRequest();
      set({ servers: memberships, isLoading: false });

      // Sélectionne le premier serveur/salon si rien n'est encore actif
      if (!get().activeServerId && memberships.length > 0) {
        get().selectServer(memberships[0].server.id);
      }
    } catch (err) {
      set({ error: err.data?.error || err.message, isLoading: false });
    }
  },

  selectServer: (serverId) => {
    const membership = get().servers.find((m) => m.server.id === serverId);
    const firstChannel = membership?.server.channels?.[0]?.id || null;
    set({ activeServerId: serverId, activeChannelId: firstChannel });
  },

  selectChannel: (channelId) => set({ activeChannelId: channelId }),

  createServer: async (name) => {
    set({ error: null });
    try {
      const server = await createServerRequest(name);
      await get().fetchServers();
      // On renvoie le serveur créé (avec inviteCode) pour que la modale
      // puisse l'afficher juste après la création
      return { success: true, server };
    } catch (err) {
      const message = err.data?.error || 'Erreur lors de la création du serveur';
      set({ error: message });
      return { success: false, error: message };
    }
  },

  joinServer: async (inviteCode) => {
    set({ error: null });
    try {
      await joinServerRequest(inviteCode);
      await get().fetchServers();
      return { success: true };
    } catch (err) {
      const message = err.data?.error || 'Code invalide';
      set({ error: message });
      return { success: false, error: message };
    }
  },

  createChannel: async (name, type = 'TEXT') => {
    const serverId = get().activeServerId;
    if (!serverId) return { success: false };

    set({ error: null });
    try {
      await createChannelRequest(serverId, name, type);
      await get().fetchServers();
      return { success: true };
    } catch (err) {
      const message = err.data?.error || 'Erreur lors de la création du salon';
      set({ error: message });
      return { success: false, error: message };
    }
  },
}));