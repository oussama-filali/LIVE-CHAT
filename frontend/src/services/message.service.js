import { apiRequest } from './http';

const BASE = import.meta.env.VITE_API_URL_MESSAGES || 'http://localhost:3000/api/messages';

export const getChannelMessagesRequest = (channelId) => apiRequest(BASE, `/channel/${channelId}`);