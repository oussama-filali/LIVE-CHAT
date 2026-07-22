# Discord Clone - Temps Réel

Application temps réel type Discord (serveurs, channels, chat texte et appel vocal) avec une architecture MVC stricte et sécurisée (OWASP Top 10:2025).

## Stack Technique
- **Backend:** Node.js, Express, Prisma (PostgreSQL), MongoDB (Messages), Redis (Présence, WebRTC)
- **Frontend:** React (Vite), Socket.io-client
- **Temps Réel:** Socket.io (Chat), WebRTC (Voix/Vidéo)
- **Infrastructure:** Docker, Docker-compose, GitHub Actions

## Installation et Lancement

1. Cloner le dépôt
2. Créer un fichier `.env` dans le dossier `backend/` en se basant sur le fichier `backend/.env.example`
   - **Important:** Les variables `JWT_SECRET` et `JWT_REFRESH_SECRET` ne doivent pas avoir de valeurs par défaut dans `docker-compose.yml` en production. Vous **devez** les définir dans votre fichier `.env` local.
3. Lancer les services via Docker:
   ```bash
   docker-compose up --build
   ```

## Sécurité
- JWT dans les cookies httpOnly, Strict, Secure (pas de localStorage).
- Zod pour la validation stricte des variables d'environnement (`fail-fast`).
- Rate limiting pour l'authentification et global.
- Ports DB non exposés publiquement dans `docker-compose.yml`.
