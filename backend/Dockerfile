FROM node:20-alpine

# Installation d'OpenSSL et libc6-compat requis par le moteur Prisma sur Alpine
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Copie des fichiers de dépendances
COPY package*.json ./

# Installation propre des dépendances
RUN npm ci

# Copie explicite du dossier prisma avant la génération du client
COPY prisma ./prisma/
RUN npx prisma generate

# Copie du reste du code source
COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]