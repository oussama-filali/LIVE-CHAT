import { create } from 'zustand';
import api from '../services/api';

export const useAuthStore = create((set, get) => ({
  user: JSON.parse(localStorage.getItem('chat_user')) || null,
  isAuthenticated: !!localStorage.getItem('chat_user'),
  isChecking: true,
  error: null,

  login: async (email, password) => {
    set({ error: null });
    try {
      const response = await api.post('/api/auth/login', { email, password });
      const user = response.data;
      localStorage.setItem('chat_user', JSON.stringify(user));
      set({ user, isAuthenticated: true, error: null });
      return user;
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Échec de la connexion';
      set({ error: errMsg });
      throw new Error(errMsg);
    }
  },

  register: async (username, email, password) => {
    set({ error: null });
    try {
      const response = await api.post('/api/auth/register', { username, email, password });
      const user = response.data;
      localStorage.setItem('chat_user', JSON.stringify(user));
      set({ user, isAuthenticated: true, error: null });
      return user;
    } catch (err) {
      // Si la validation Zod échoue, le backend renvoie un tableau d'erreurs
      const errData = err.response?.data?.error;
      const errMsg = Array.isArray(errData) 
        ? errData.map(e => e.message).join(', ') 
        : (errData || 'Échec de l\'inscription');
      set({ error: errMsg });
      throw new Error(errMsg);
    }
  },

  logout: async () => {
    try {
      await api.post('/api/auth/logout');
    } catch (err) {
      console.error('Erreur lors de la déconnexion backend', err);
    } finally {
      localStorage.removeItem('chat_user');
      set({ user: null, isAuthenticated: false, error: null });
    }
  },

  checkAuth: async () => {
    set({ isChecking: true });
    const localUser = localStorage.getItem('chat_user');
    if (!localUser) {
      set({ user: null, isAuthenticated: false, isChecking: false });
      return;
    }

    try {
      // Appeler le refresh pour vérifier que la session est toujours valide et renouveler l'accessToken
      await api.post('/api/auth/refresh');
      set({ user: JSON.parse(localUser), isAuthenticated: true, isChecking: false });
    } catch (err) {
      console.warn('Session expirée ou invalide lors du rafraîchissement', err);
      localStorage.removeItem('chat_user');
      set({ user: null, isAuthenticated: false, isChecking: false });
    }
  },
}));
