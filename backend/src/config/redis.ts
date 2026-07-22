import { createClient } from 'redis';
import { env } from './env.js';

export const redisClient = createClient({
  url: env.REDIS_URL
});

redisClient.on('error', (err) => console.error('❌ Erreur Redis Client', err));

export const connectRedis = async () => {
  try {
    await redisClient.connect();
    console.log('✅ Redis connecté (Présence/Voix)');
  } catch (error) {
    console.error('❌ Erreur de connexion Redis:', error);
    process.exit(1);
  }
};