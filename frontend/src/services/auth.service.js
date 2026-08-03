// Base URL du backend. En dev, appel direct sur le port du serveur Express.
// Passe par VITE_API_URL si tu ajoutes un .env plus tard.
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/auth';

// Wrapper fetch commun : envoie les cookies (credentials: 'include'),
// parse le JSON, et transforme une réponse non-ok en erreur exploitable
// par le store (le backend renvoie { error: "..." } ou { error: [...] } via Zod).
async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include', // indispensable : sans ça, le cookie httpOnly n'est ni envoyé ni reçu
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const error = new Error(data?.error || 'Erreur réseau');
    error.data = data;
    error.status = res.status;
    throw error;
  }

  return data;
}

export const registerRequest = (payload) =>
  request('/register', { method: 'POST', body: JSON.stringify(payload) });

export const loginRequest = (payload) =>
  request('/login', { method: 'POST', body: JSON.stringify(payload) });

export const logoutRequest = () =>
  request('/logout', { method: 'POST' });

export const meRequest = () =>
  request('/me', { method: 'GET' });

export const refreshRequest = () =>
  request('/refresh', { method: 'POST' });
