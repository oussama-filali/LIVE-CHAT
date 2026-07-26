# Stratégie de branches — équipe de 4

## Schéma

```
main                     → production, protégée, jamais de push direct, CI verte obligatoire
 └── dev                 → intégration, doit toujours rester stable
      ├── dev-oussama        → Backend : Auth + Utilisateurs/Serveurs/Canaux (API REST + Prisma)
      ├── dev-<membre2>      → Backend : Chat temps réel (Socket.io /chat + MongoDB)
      ├── dev-<membre3>      → Backend : Voix/WebRTC + présence (Socket.io /voice + Redis)
      └── dev-<membre4>      → Frontend : React (UI, routing, store, intégration sockets)
```

Chaque branche a un périmètre de fichiers clairement séparé (voir tableau) pour
minimiser les conflits de merge à 4 personnes.

## Règles

1. Personne ne push directement sur `main` ni sur `dev`.
2. Chaque membre travaille sur sa branche `dev-<prenom>`, avec des commits atomiques
   et des messages clairs (ce qui a changé et pourquoi).
3. Pull Request `dev-<prenom>` → `dev`, relue par au moins un autre membre avant merge
   (même à 4, la relecture croisée évite les erreurs basiques).
4. `dev` → `main` seulement quand : CI verte + fonctionnalité testée manuellement
   (checklist rapide : login, création serveur/canal, envoi message, appel vocal).
5. Se resynchroniser souvent : `git pull origin dev` régulièrement dans sa branche
   pour éviter une divergence trop grande — à 4, un point de sync 2-3 fois/semaine
   suffit largement.
6. Si un fichier transverse doit être touché par deux personnes (ex: brancher une
   route dans `backend/src/server.js`), se prévenir avant de push.

## Répartition proposée (à confirmer avec les vrais prénoms/préférences)

| Branche | Domaine | Fichiers principaux |
|---|---|---|
| `dev-oussama` | Auth + Users/Servers/Channels (API REST) | `backend/src/controllers/*`, `routes/*`, `repositories/{user,server,channel}.repository.js` |
| `dev-<membre2>` | Chat temps réel | `backend/src/sockets/chat.js`, `repositories/message.repository.js`, modèle Mongoose `Message` |
| `dev-<membre3>` | Voix/WebRTC + présence | `backend/src/sockets/webrtc.js`, logique de présence Redis |
| `dev-<membre4>` | Frontend | `frontend/src/**` (pages, composants, store, routing) |

## Pourquoi ce découpage plutôt qu'un découpage "1 branche = 1 personne au hasard"

Chaque branche correspond à un module fonctionnel indépendant du MCD/MLD
([mcd-mld.md](../docs/mcd-mld.md)) : Auth/Users/Servers/Channels d'un côté,
Message (Mongo) de l'autre, présence/voix (Redis, éphémère) à part, et le
Frontend qui consomme les trois. Ça permet à chacun d'avancer sans attendre
les autres, et le merge dans `dev` "assemble" le projet complet.
