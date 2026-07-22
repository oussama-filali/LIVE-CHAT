import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export const connectPostgres = async () => {
  try {
    await prisma.$connect();
    console.log('✅ PostgreSQL connecté via Prisma');
  } catch (error) {
    console.error('❌ Erreur de connexion PostgreSQL:', error);
    process.exit(1);
  }
};