# TODO — LIVE-CHAT

## Déjà fait (branche `dev`)

- Repo initialisé + README à jour
- `docker-compose.yml` : services postgres, mongo, redis, backend, frontend
- CI GitHub Actions : scan de secrets (Gitleaks) + jobs lint/test (stubs)
- Backend : bootstrap Express + Socket.io, validation des variables d'env (Zod,
  fail-fast), connecteurs Postgres (Prisma) / Mongo / Redis, middlewares sécurité
  (helmet, cors, rate limiter, error handler), middleware `requireAuth` (JWT via
  cookie httpOnly) — squelette uniquement, pas encore branché sur de vraies routes
- `backend/prisma/schema.prisma` : `User`, `Server`, `Channel`, `Membership`
  (rôles) — conforme au MCD/MLD ([docs/mcd-mld.md](../docs/mcd-mld.md))
- Sockets `/chat` et `/voice` : connexion + join-room seulement, TODO explicites
  dans le code pour la persistance
- Frontend : squelette Vite + React (page statique "Discord Clone Frontend Initialized")
- `docs/` : placeholders vides (`*.png`, `socket-events.md`) à remplir plus tard

## Installations / mise en place (avant de coder)

1. Node.js 20 LTS + npm
2. Docker Desktop (pour lancer postgres/mongo/redis en local)
3. `cd backend && npm install`
4. `cd frontend && npm install`
5. Copier `backend/.env.example` → `backend/.env`, générer de vrais secrets
   (`JWT_SECRET` / `JWT_REFRESH_SECRET` ≥ 32 caractères, ex: `openssl rand -hex 32`)
6. `docker-compose up postgres mongo redis -d` (bases de données en local)
7. Initialiser Prisma : `cd backend && npx prisma migrate dev --name init`
   (aucune migration n'existe encore dans le repo)
8. Ajouter la config ESLint manquante (backend + frontend) — `npm run lint` est
   référencé dans les `package.json` mais aucun `.eslintrc`/`eslint.config.js`
   n'existe encore
9. Choisir et installer un test runner (proposition : Vitest — léger, rapide,
   fonctionne pour backend et frontend)

## Développement — fichier par fichier, par domaine

### A. Auth / Utilisateurs / Serveurs / Canaux — `dev-oussama`
- [ ] `backend/src/repositories/user.repository.js`
- [ ] `backend/src/services/auth.service.js` (hash bcrypt, génération JWT access + refresh)
- [ ] `backend/src/controllers/auth.controller.js` + `routes/auth.routes.js`
      (register, login, refresh, logout) + validation Zod des payloads
- [ ] `backend/src/controllers/server.controller.js` + `routes/server.routes.js`
- [ ] `backend/src/controllers/channel.controller.js` + `routes/channel.routes.js`
- [ ] Middleware RBAC (vérifie `Membership.role` avant une action sensible :
      créer un canal, changer un rôle, etc.)
- [ ] Brancher les routes dans `backend/src/server.js` (lignes actuellement commentées)

### B. Chat temps réel — `dev-<membre2>`
- [ ] Modèle Mongoose `Message` (channelId, authorId, content, attachments, edited, createdAt)
- [ ] `backend/src/repositories/message.repository.js`
- [ ] Authentifier le socket `/chat` (vérifier le JWT au handshake, pas seulement à la connexion)
- [ ] Compléter `backend/src/sockets/chat.js` : persister le message reçu puis
      diffuser à la room correspondante
- [ ] Route REST `GET /channels/:id/messages` (historique paginé)

### C. Voix / WebRTC + présence — `dev-<membre3>`
- [ ] Authentifier le socket `/voice`
- [ ] Présence Redis (set des utilisateurs connectés par canal vocal)
- [ ] Compléter la signalisation WebRTC (offer/answer/ICE candidates) dans
      `backend/src/sockets/webrtc.js`
- [ ] Nettoyage à la déconnexion (retrait Redis + notification aux autres participants)

### D. Frontend — `dev-<membre4>`
- [ ] Routing (`react-router-dom`) : `/login`, `/register`, `/servers/:id/channels/:id`
- [ ] Store Zustand : état auth, serveur/canal courant, messages
- [ ] Pages Login / Register (formulaires + appel API backend)
- [ ] Layout principal : sidebar serveurs, liste des canaux, zone de chat
- [ ] Intégration `socket.io-client` (namespaces `/chat` et `/voice`)
- [ ] Composant Chat (liste de messages + input) et composant Vocal (join/leave/mute)

### E. Transverse (peut être fait par n'importe qui, à répartir)
- [ ] Config ESLint (backend + frontend)
- [ ] Tests unitaires de base (au minimum `auth.service` et `message.repository`)
- [ ] Remplir `docs/socket-events.md` (contrat d'événements socket partagé entre les 4)
- [ ] Générer les vrais schémas `docs/mcd.png`, `docs/architecture.png`,
      `docs/webrtc-sequence.png` à partir des sources Mermaid fournies

## Règles de code à respecter (rappel)

- Une seule responsabilité par fichier : `controller` ≠ `service` ≠ `repository`
- Toute route sensible passe par `requireAuth` (+ middleware RBAC si nécessaire)
- Toute entrée utilisateur est validée par Zod avant traitement
- Pas de logique métier directement dans les handlers de socket → déléguer aux
  services/repositories
