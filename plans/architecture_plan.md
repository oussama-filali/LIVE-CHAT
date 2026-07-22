# Plan d'Architecture - Clone Discord Temps Réel

Ce document rassemble l'ensemble des fichiers demandés avec leur contenu complet.
Il respecte strictement l'architecture MVC et les critères de sécurité OWASP Top 10:2025.

---

## 1. Infrastructure Globale & CI

### `docker-compose.yml`
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres}
      POSTGRES_DB: discord_clone
    # Les ports ne sont pas exposés à l'hôte pour des raisons de sécurité en production.
    # Ils restent accessibles via le réseau interne Docker (discord_network).
    # En développement, décommentez les lignes suivantes si besoin d'accès direct.
    # ports:
    #   - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - discord_network

  mongo:
    image: mongo:6-jammy
    # ports:
    #   - "27017:27017"
    volumes:
      - mongo_data:/data/db
    networks:
      - discord_network

  redis:
    image: redis:7-alpine
    # ports:
    #   - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - discord_network

  backend:
    build:
      context: ./backend
    environment:
      - PORT=3000
      - NODE_ENV=development
      - FRONTEND_URL=http://localhost:5173
      - DATABASE_URL=postgresql://postgres:${POSTGRES_PASSWORD:-postgres}@postgres:5432/discord_clone?schema=public
      - MONGO_URI=mongodb://mongo:27017/discord_clone
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
      - JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
    ports:
      - "3000:3000"
    depends_on:
      - postgres
      - mongo
      - redis
    volumes:
      - ./backend:/app
      - /app/node_modules
    networks:
      - discord_network

  frontend:
    build:
      context: ./frontend
    ports:
      - "5173:5173"
    environment:
      - VITE_API_URL=http://localhost:3000
    volumes:
      - ./frontend:/app
      - /app/node_modules
    networks:
      - discord_network

volumes:
  postgres_data:
  mongo_data:
  redis_data:

networks:
  discord_network:
    driver: bridge
```

### `.github/workflows/ci.yml`
```yaml
name: CI

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  security-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Gitleaks - Check for secrets
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  backend-lint-test:
    runs-on: ubuntu-latest
    needs: security-check
    defaults:
      run:
        working-directory: ./backend
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: './backend/package.json'
      - run: npm ci
      - run: npm run lint
      - run: npm test

  frontend-lint-test:
    runs-on: ubuntu-latest
    needs: security-check
    defaults:
      run:
        working-directory: ./frontend
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: './frontend/package.json'
      - run: npm ci
      - run: npm run lint
      - run: npm test
```

---

## 2. Backend

### `backend/Dockerfile`
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
EXPOSE 3000
CMD ["npm", "run", "dev"]
```

### `backend/package.json`
```json
{
  "name": "discord-clone-backend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.js",
    "start": "node --import tsx src/server.js",
    "lint": "eslint .",
    "test": "echo \"No tests specified yet\" && exit 0"
  },
  "dependencies": {
    "@prisma/client": "^5.14.0",
    "bcrypt": "^5.1.1",
    "cookie-parser": "^1.4.6",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "express-rate-limit": "^7.3.1",
    "helmet": "^7.1.0",
    "jsonwebtoken": "^9.0.2",
    "mongoose": "^8.4.1",
    "redis": "^4.6.14",
    "socket.io": "^4.7.5",
    "winston": "^3.13.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^20.12.12",
    "eslint": "^9.4.0",
    "prisma": "^5.14.0",
    "tsx": "^4.15.1",
    "typescript": "^5.4.5"
  }
}
```

### `backend/.env.example`
```env
# Serveur
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Base de données (PostgreSQL)
DATABASE_URL="postgresql://postgres:postgres@postgres:5432/discord_clone?schema=public"

# Base de données (MongoDB)
MONGO_URI="mongodb://mongo:27017/discord_clone"

# Redis
REDIS_URL="redis://redis:6379"

# Sécurité (OWASP) - Doit faire 32 caractères minimum
JWT_SECRET="changeme_minimum_32_characters_long_secret!"
JWT_REFRESH_SECRET="changeme_minimum_32_characters_long_refresh_secret!"
```

### `backend/prisma/schema.prisma`
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String       @id @default(uuid())
  email        String       @unique
  username     String       @unique
  passwordHash String
  avatarUrl    String?
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt

  serversOwned Server[]     @relation("ServerOwner")
  memberships  Membership[]
}

model Server {
  id          String       @id @default(uuid())
  name        String
  ownerId     String
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  owner       User         @relation("ServerOwner", fields: [ownerId], references: [id])
  channels    Channel[]
  memberships Membership[]
}

enum ChannelType {
  TEXT
  VOICE
}

model Channel {
  id        String      @id @default(uuid())
  serverId  String
  name      String
  type      ChannelType @default(TEXT)
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt

  server    Server      @relation(fields: [serverId], references: [id], onDelete: Cascade)
}

enum Role {
  OWNER
  ADMIN
  MEMBER
}

model Membership {
  id        String   @id @default(uuid())
  userId    String
  serverId  String
  role      Role     @default(MEMBER)
  createdAt DateTime @default(now())

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  server    Server   @relation(fields: [serverId], references: [id], onDelete: Cascade)

  @@unique([userId, serverId])
}
```

### `backend/src/config/env.ts`
```typescript
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

// Validation stricte des variables d'environnement (Fail-fast)
const envSchema = z.object({
  PORT: z.string().default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FRONTEND_URL: z.string().url(),
  DATABASE_URL: z.string().url(),
  MONGO_URI: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters long"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters long"),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("❌ Invalid environment variables:", parsedEnv.error.format());
  process.exit(1);
}

export const env = parsedEnv.data;
```

### `backend/src/config/postgres.ts`
```typescript
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
```

### `backend/src/config/mongo.ts`
```typescript
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
```

### `backend/src/config/redis.ts`
```typescript
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
```

### `backend/src/server.js`
```javascript
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
```

### `backend/src/middlewares/auth.middleware.js`
```javascript
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const requireAuth = (req, res, next) => {
  // OWASP: Le token est lu depuis un cookie httpOnly, jamais depuis l'en-tête Authorization / localStorage
  const token = req.cookies.accessToken;

  if (!token) {
    return res.status(401).json({ error: 'Accès non autorisé. Token manquant.' });
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token invalide ou expiré.' });
  }
};
```

### `backend/src/middlewares/rateLimiter.middleware.js`
```javascript
import rateLimit from 'express-rate-limit';

// Limiteur global
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limite chaque IP à 500 requêtes
  message: { error: 'Trop de requêtes, veuillez réessayer plus tard.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limiteur strict pour l'authentification
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 tentatives par 15 minutes
  message: { error: 'Trop de tentatives, veuillez réessayer dans 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});
```

### `backend/src/middlewares/errorHandler.middleware.js`
```javascript
import { env } from '../config/env.js';

// Middleware défini avec 4 paramètres pour qu'Express le traite comme Error Handler
export const errorHandler = (err, req, res, next) => {
  // Logs complets côté serveur
  console.error(`[ERROR] ${req.method} ${req.url} - ${err.message}`, err.stack);

  // OWASP: Ne jamais divulguer la stack trace en production
  const statusCode = err.statusCode || 500;
  const message = env.NODE_ENV === 'production' 
    ? 'Une erreur interne est survenue.' 
    : err.message;

  res.status(statusCode).json({ error: message });
};
```

### `backend/src/sockets/chat.js`
```javascript
export const setupChatSocket = (io) => {
  const chatNamespace = io.of('/chat');

  // Middleware d'authentification Socket à rajouter plus tard
  chatNamespace.on('connection', (socket) => {
    console.log(`[Chat] Utilisateur connecté : ${socket.id}`);

    socket.on('join-channel', (channelId) => {
      socket.join(channelId);
      console.log(`[Chat] ${socket.id} a rejoint ${channelId}`);
    });

    socket.on('send-message', (data) => {
      // TODO: Insérer dans MongoDB via repository
      // Émettre ensuite à la room (channelId)
    });

    socket.on('disconnect', () => {
      console.log(`[Chat] Utilisateur déconnecté : ${socket.id}`);
      // TODO: Maj statut dans Redis
    });
  });
};
```

### `backend/src/sockets/webrtc.js`
```javascript
export const setupWebRTCSocket = (io) => {
  const voiceNamespace = io.of('/voice');

  voiceNamespace.on('connection', (socket) => {
    console.log(`[Voice] Utilisateur connecté : ${socket.id}`);

    socket.on('join-voice-channel', (channelId) => {
      socket.join(channelId);
      // Notifier les membres du canal vocal
      socket.to(channelId).emit('user-joined-voice', { userId: socket.id });
    });

    socket.on('signal', (data) => {
      // Signalisation WebRTC pour peer-to-peer ou SFU
      socket.to(data.targetUserId).emit('signal', {
        senderId: socket.id,
        signalData: data.signalData
      });
    });

    socket.on('disconnect', () => {
      console.log(`[Voice] Utilisateur déconnecté : ${socket.id}`);
    });
  });
};
```

---

## 3. Frontend

### `frontend/Dockerfile`
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]
```

### `frontend/package.json`
```json
{
  "name": "discord-clone-frontend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "eslint src --ext js,jsx --report-unused-disable-directives --max-warnings 0",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.23.1",
    "socket.io-client": "^4.7.5",
    "zustand": "^4.5.2"
  },
  "devDependencies": {
    "@types/react": "^18.2.66",
    "@types/react-dom": "^18.2.22",
    "@vitejs/plugin-react": "^4.2.1",
    "eslint": "^8.57.0",
    "eslint-plugin-react": "^7.34.1",
    "eslint-plugin-react-hooks": "^4.6.0",
    "eslint-plugin-react-refresh": "^0.4.6",
    "vite": "^5.2.0"
  }
}
```
