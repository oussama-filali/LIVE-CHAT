import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import { env } from './config/env.js';
import { connectMongo } from './config/mongo.js';
import { connectRedis } from './config/redis.js';
import { connectPostgres } from './config/postgres.js';

import { globalLimiter } from './middlewares/rateLimiter.middleware.js';
import { errorHandler } from './middlewares/errorHandler.middleware.js';

// Import Sockets
import { setupChatSocket } from './sockets/chat.js';
import { setupWebRTCSocket } from './sockets/webrtc.js';

const app = express();
const server = http.createServer(app);

// Configuration Socket.io avec restrictions CORS
const io = new Server(server, {
  cors: {
    origin: env.FRONTEND_URL,
    credentials: true,
  }
});

// OWASP: Masquer la technologie utilisée
app.disable('x-powered-by');

// Middlewares globaux de sécurité
app.use(helmet());
app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true, // Requis pour l'envoi de cookies httpOnly
}));
app.use(express.json());
app.use(cookieParser());

// OWASP: Protection contre les attaques DDoS (basique) et brute force
app.use(globalLimiter);

// Routes (à remplacer par les vrais imports)
// app.use('/api/auth', authRoutes);
// app.use('/api/servers', serversRoutes);
// app.use('/api/channels', channelsRoutes);

// Catch 404
app.use((req, res) => {
  res.status(404).json({ error: 'Ressource introuvable' });
});

// OWASP A10:2025 - Mishandling of Exceptional Conditions (doit être le dernier)
app.use(errorHandler);

// Initialisation des Sockets
setupChatSocket(io);
setupWebRTCSocket(io);

// Lancement de l'application
async function startServer() {
  try {
    await connectPostgres();
    await connectMongo();
    await connectRedis();
    
    server.listen(env.PORT, () => {
      console.log(`🚀 Serveur en écoute sur le port ${env.PORT}`);
    });
  } catch (error) {
    console.error('❌ Échec du lancement du serveur:', error);
    process.exit(1);
  }
}

startServer();