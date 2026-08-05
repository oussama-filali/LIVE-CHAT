import { apiRequest } from './http';

const BASE = import.meta.env.VITE_API_URL_SERVERS || 'http://localhost:3000/api/servers';

export const getUserServersRequest = () => apiRequest(BASE, '/me');

export const createServerRequest = (name) =>
  apiRequest(BASE, '/', { method: 'POST', body: JSON.stringify({ name }) });

export const joinServerRequest = (inviteCode) =>
  apiRequest(BASE, '/join', { method: 'POST', body: JSON.stringify({ inviteCode }) });

export const createChannelRequest = (serverId, name, type = 'TEXT') =>
  apiRequest(BASE, `/${serverId}/channels`, {
    method: 'POST',
    body: JSON.stringify({ name, type }),
  });