// Même logique que services/auth.service.js : fetch natif, cookies inclus,
// erreurs normalisées. Factorisé ici pour server.service.js et message.service.js.
export async function apiRequest(base, path, options = {}) {
  const res = await fetch(`${base}${path}`, {
    credentials: 'include',
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