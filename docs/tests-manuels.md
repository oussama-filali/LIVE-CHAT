# Plan de tests manuels — LIVE-CHAT

Ce document explique **comment tester le backend à la main**, sans interface
graphique, et liste les scénarios de sécurité déjà validés.

## Comprendre le principe (pour débutants)

Un serveur web = une machine qui **répond à des requêtes**. Pour le tester, on lui
envoie des requêtes et on regarde le **code HTTP** de sa réponse.

Codes qu'on rencontre ici :

| Code | Signification |
|------|---------------|
| 200 / 201 | OK, l'action a réussi |
| 400 | requête mal formée (données invalides) |
| 401 | pas authentifié (pas connecté) |
| 403 | authentifié MAIS pas le droit (autorisation refusée) |
| 404 | ressource introuvable |
| 409 | conflit (ex: email déjà utilisé) |

Deux outils possibles pour envoyer les requêtes :
- **Postman** (demandé dans le cahier des charges) : visuel, gère les cookies tout seul.
- **curl** (ligne de commande) : rapide à scripter, ce qu'on utilise ci-dessous.

### Le point clé : les cookies (simuler plusieurs utilisateurs)

L'authentification passe par un cookie `httpOnly` (le token JWT). Avec curl, on
stocke les cookies de chaque utilisateur dans un fichier séparé (un "cookie jar") :

- `-c fichier.txt` = **enregistre** les cookies reçus (à la connexion)
- `-b fichier.txt` = **renvoie** ces cookies (= agir *en tant que* cet utilisateur)

Ainsi `-b B.txt` veut dire « je fais cette requête en me faisant passer pour B ».
C'est comme ça qu'on teste « est-ce que B a le droit de faire telle action ? ».

## Prérequis

Bases de données et serveur backend lancés :
```bash
docker-compose up postgres mongo redis -d
cd backend && npm run dev
```

## Scénario 1 — Authentification (REST)

```bash
API=http://localhost:3000/api

# Inscription (renvoie 201 + pose les cookies)
curl -i -X POST $API/auth/register -H "Content-Type: application/json" \
  -d '{"username":"alice","email":"alice@x.com","password":"test123"}'

# Connexion (200)
curl -i -X POST $API/auth/login -H "Content-Type: application/json" \
  -d '{"email":"alice@x.com","password":"test123"}'

# Mauvais mot de passe -> 401, même message que "email inconnu"
# (volontaire : empêche de deviner quels comptes existent)
curl -X POST $API/auth/login -H "Content-Type: application/json" \
  -d '{"email":"alice@x.com","password":"FAUX"}'
```

## Scénario 2 — Autorisation métier (RBAC) ✅ validé

Vérifie que « seul l'admin gère le serveur » (cahier des charges, section Sécurité).

```bash
API=http://localhost:3000/api

# A = propriétaire, B = étranger (cookies dans 2 fichiers distincts)
curl -s -c A.txt -X POST $API/auth/register -H "Content-Type: application/json" \
  -d '{"username":"owner1","email":"owner1@x.com","password":"test123"}'
curl -s -c B.txt -X POST $API/auth/register -H "Content-Type: application/json" \
  -d '{"username":"extern1","email":"extern1@x.com","password":"test123"}'

# A crée un serveur -> devient OWNER, récupère son id + inviteCode dans la réponse
curl -s -b A.txt -X POST $API/servers -H "Content-Type: application/json" -d '{"name":"TeamA"}'
```

Résultats attendus (remplacer `<SID>` par l'id du serveur, `<CODE>` par l'inviteCode) :

| Action | Commande (résumée) | Attendu |
|--------|--------------------|---------|
| B (non-membre) crée un salon | `-b B.txt POST /servers/<SID>/channels` | **403** |
| A (OWNER) crée un salon | `-b A.txt POST /servers/<SID>/channels` | 201 |
| B rejoint le serveur | `-b B.txt POST /servers/join {inviteCode}` | 200 |
| B (MEMBER) se promeut OWNER | `-b B.txt PATCH /servers/<SID>/members/<BID>/role` | **403** |
| A (OWNER) change le rôle de B | `-b A.txt PATCH /servers/<SID>/members/<BID>/role` | 200 |

Les deux **403** prouvent que la faille « n'importe qui peut se promouvoir OWNER »
est bien fermée.

## Scénario 3 — Authentification des sockets ✅ validé

Vérifie que les namespaces `/chat` et `/voice` refusent les connexions non
authentifiées (cahier des charges : « Vérification du token à la connexion socket »).

| Connexion socket sur `/chat` | Attendu |
|------------------------------|---------|
| sans cookie | rejetée : « Authentification requise » |
| avec un token valide | acceptée |
| avec un token invalide/expiré | rejetée : « Token invalide ou expiré » |

Test réalisé avec un petit script `socket.io-client` (cf. historique de dev). En
production réelle, ce scénario se re-teste depuis le frontend une fois connecté.

## À compléter plus tard

- Messagerie temps réel (envoi/réception de messages, historique MongoDB)
- Présence (statuts online/away/busy en temps réel)
- Appels WebRTC (offer/answer/ICE, contrôles d'appel)
