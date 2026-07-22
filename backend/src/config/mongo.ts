import mongoose from 'mongoose';
import { env } from './env.js';

export const connectMongo = async () => {
  try {
    await mongoose.connect(env.MONGO_URI);
    console.log('✅ MongoDB connecté (Messages)');
  } catch (error) {
    console.error('❌ Erreur de connexion MongoDB:', error);
    process.exit(1);
  }
};