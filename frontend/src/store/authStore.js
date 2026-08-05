import { create } from 'zustand';
import {
  registerRequest,
  loginRequest,
  logoutRequest,
  meRequest,
} from '../services/auth.service';

// Le back renvoie soit { error: "message" } soit { error: [ {message}, ... ] }
// (erreurs Zod) selon le cas. On uniformise pour l'affichage.
const extractErrorMessage = (err) => {
  const data = err.data?.error;
  if (Array.isArray(data)) return data.map((e) => e.message).join(', ');
  return data || err.message || 'Une erreur est survenue';
};

export const useAuthStore = create((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true, // true tant qu'on n'a pas vérifié la session au chargement
  error: null,

  register: async (formData) => {
    set({ error: null });
    try {
      const user = await registerRequest(formData);
      set({ user, isAuthenticated: true });
      return { success: true };
    } catch (err) {
      const message = extractErrorMessage(err);
      set({ error: message });
      return { success: false, error: message };
    }
  },

  login: async (formData) => {
    set({ error: null });
    try {
      const user = await loginRequest(formData);
      set({ user, isAuthenticated: true });
      return { success: true };
    } catch (err) {
      const message = extractErrorMessage(err);
      set({ error: message });
      return { success: false, error: message };
    }
  },

  logout: async () => {
    try {
      await logoutRequest();
    } finally {
      set({ user: null, isAuthenticated: false });
    }
  },

  // Appelé une fois au montage de l'app pour restaurer la session
  // si un cookie accessToken valide existe déjà
  checkAuth: async () => {
    set({ isLoading: true });
    try {
      const user = await meRequest();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
