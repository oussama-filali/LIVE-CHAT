import { redisClient } from '../config/redis.js';

/**
 * Service gérant la présence des utilisateurs via Redis (Scalabilité)
 * Gère les statuts: online (en ligne), busy (occupé), offline (absent)
 */

export const setUserChatSocket = async (userId, socketId) => {
  const currentCount = await redisClient.sCard(`user:${userId}:chat_sockets`);
  if (currentCount >= 2) {
    return { error: 'MAX_TABS_REACHED' };
  }
  // Ajoute l'ID du socket chat à l'utilisateur
  await redisClient.sAdd(`user:${userId}:chat_sockets`, socketId);
  return await evaluateUserStatus(userId);
};

export const removeUserChatSocket = async (userId, socketId) => {
  // Retire l'ID du socket chat
  await redisClient.sRem(`user:${userId}:chat_sockets`, socketId);
  return await evaluateUserStatus(userId);
};

export const setUserVoiceSocket = async (userId, socketId) => {
  // Ajoute l'ID du socket vocal
  await redisClient.sAdd(`user:${userId}:voice_sockets`, socketId);
  return await evaluateUserStatus(userId);
};

export const removeUserVoiceSocket = async (userId, socketId) => {
  // Retire l'ID du socket vocal
  await redisClient.sRem(`user:${userId}:voice_sockets`, socketId);
  return await evaluateUserStatus(userId);
};

/**
 * Évalue et met à jour le statut global de l'utilisateur
 * @returns {Promise<{ status: string, changed: boolean }>} 
 */
const evaluateUserStatus = async (userId) => {
  const [chatSocketsCount, voiceSocketsCount] = await Promise.all([
    redisClient.sCard(`user:${userId}:chat_sockets`),
    redisClient.sCard(`user:${userId}:voice_sockets`),
  ]);

  let newStatus = 'offline';
  if (voiceSocketsCount > 0) {
    newStatus = 'busy'; // Occupé (en vocal)
  } else if (chatSocketsCount > 0) {
    newStatus = 'online'; // En ligne (sur l'app)
  }

  // Vérifier l'ancien statut pour ne pas spammer d'événements si ça n'a pas changé
  const oldStatus = await redisClient.get(`user:${userId}:status`);
  
  if (oldStatus !== newStatus) {
    if (newStatus === 'offline') {
      await redisClient.del(`user:${userId}:status`);
    } else {
      await redisClient.set(`user:${userId}:status`, newStatus);
    }
    await pingPresence(userId);
    return { status: newStatus, changed: true };
  }

  await pingPresence(userId);
  return { status: newStatus, changed: false };
};

/**
 * Renouvelle le TTL (Time To Live) de 5 minutes pour l'utilisateur
 */
export const pingPresence = async (userId) => {
  const TTL = 300; // 5 minutes en secondes
  await Promise.all([
    redisClient.expire(`user:${userId}:chat_sockets`, TTL),
    redisClient.expire(`user:${userId}:voice_sockets`, TTL),
    redisClient.expire(`user:${userId}:status`, TTL)
  ]);
};

/**
 * Récupérer le statut actuel d'un utilisateur
 */
export const getUserStatus = async (userId) => {
  const status = await redisClient.get(`user:${userId}:status`);
  return status || 'offline';
};