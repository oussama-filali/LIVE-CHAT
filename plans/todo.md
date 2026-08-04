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

> Rappel archi : on est passés à une organisation **par module**
> (`backend/src/modules/<domaine>/`) au lieu de dossiers par type. Le transverse
> (utilisé par plusieurs modules) reste dans `middlewares/` et `config/`.

### A. Auth / Utilisateurs / Serveurs / Canaux — `dev-oussama`
- [x] `backend/src/modules/auth/auth.service.js` (hash bcrypt, génération/vérification
      JWT access + refresh) — pure logique métier, JWT durci (HS256, issuer, audience, type)
- [x] `backend/src/modules/auth/auth.controller.js` + `auth.routes.js`
      (register, login, refresh, logout) + validation Zod, cookies httpOnly
- [x] `backend/src/modules/serv/server.controller.js` + `server.routes.js`
      (créer serveur, join par code d'invitation, lister ses serveurs, créer salon,
      changer rôle) — fait par Alexis
- [x] `backend/src/middlewares/rbac.middleware.js` (`requireRole(...)` : vérifie
      `Membership.role` avant une action sensible) — branché sur create-channel
      (OWNER/ADMIN) et change-role (OWNER)
- [x] Brancher les routes dans `backend/src/server.js` (`/api/auth`, `/api/servers`)
- [ ] Contrôle d'accès en **lecture** : un membre ne doit voir que les salons/serveurs
      dont il fait partie (cahier des charges : "un membre n'accède qu'à ses serveurs")
- [ ] Profil utilisateur : avatar + statut personnalisé (clin d'œil MSN)

### B. Chat temps réel — `dev-Alexis`
- [x] Modèle Mongoose `Message` (`modules/messages/message.model.js`)
- [x] Authentifier le socket `/chat` (`requireSocketAuth`, JWT vérifié au handshake)
- [x] `sockets/chat.js` : persistance du message (Mongo) + diffusion à la room
- [x] Route REST `GET /api/messages/channel/:channelId` (historique) — ⚠️ écrite mais
      **pas encore montée dans `server.js`** ni protégée par `requireAuth`
- [ ] Indicateur de frappe (`typing` / `user-typing`)
- [ ] Messages privés (DM) + notifications non-lus

### C. Voix / WebRTC + présence — `dev-Alexis`
- [x] Authentifier le socket `/voice` (`requireSocketAuth`)
- [x] Présence Redis (`services/presence.service.js` : online/busy/offline, limite d'onglets)
- [x] Signalisation WebRTC de base (offer/answer/ICE) dans `sockets/webrtc.js`
- [x] Nettoyage à la déconnexion (retrait Redis + notif aux membres du serveur)
- [ ] Appel 1-to-1 audio/vidéo complet côté front + contrôles (mute/cam/raccrocher)
- [ ] Salon vocal de groupe en mesh (≤ 3 participants)

### D. Frontend — `dev-Mahela`
- [ ] Routing (`react-router-dom`) : `/login`, `/register`, `/servers/:id/channels/:id`
- [ ] Store Zustand : état auth, serveur/canal courant, messages
- [ ] Pages Login / Register (formulaires + appel API backend)
- [ ] Layout principal : sidebar serveurs, liste des canaux, zone de chat
- [ ] Intégration `socket.io-client` (namespaces `/chat` et `/voice`)
- [ ] Composant Chat (liste de messages + input) et composant Vocal (join/leave/mute)

### E. Transverse (peut être fait par n'importe qui, à répartir)
- [ ] Config ESLint (backend + frontend)
- [ ] Tests unitaires de base (au minimum `auth.service` et le modèle Mongoose `Message`)
- [ ] Remplir `docs/socket-events.md` (contrat d'événements socket partagé entre les 4)
- [ ] Générer les vrais schémas `docs/mcd.png`, `docs/architecture.png`,
      `docs/webrtc-sequence.png` à partir des sources Mermaid fournies
- [ ] Détracker `frontend/node_modules/` (committé par erreur avant le `.gitignore`) :
      `git rm -r --cached frontend/node_modules` — à faire en accord avec l'équipe
- [ ] Supprimer le dossier fantôme `backend/backend/` (créé par un `npm` mal placé)
- [ ] Livrables cahier des charges encore à produire : doc Swagger, collection Postman,
      `.env.example` complet, plan de tests, guide de dépannage WebSocket/WebRTC

## Règles de code à respecter (rappel)

- Une seule responsabilité par fichier : `controller` (HTTP + appel direct au
  modèle Prisma/Mongoose) ≠ `service` (logique métier réutilisable : hash, JWT,
  calculs) — pas de couche "repository" en plus, Prisma/Mongoose sont déjà
  l'accès aux données
- Toute route sensible passe par `requireAuth` (+ middleware RBAC si nécessaire)
- Toute entrée utilisateur est validée par Zod avant traitement
- Pas de logique métier directement dans les handlers de socket → déléguer aux
  services, et accéder aux données via le modèle directement
