import {prisma} from '../config/postgres.js';

export const requireRole = (...allowedRoles) => async (req, res, next) => {
    try {
        const userId = req.user.sub; // Récupère l'ID de l'utilisateur à partir du token JWT
        const {serverId} = req.params; // Récupère l'ID du serveur à partir des paramètres de la requête

        // Vérifie si l'utilisateur a un rôle autorisé pour le serveur spécifié
        const membership = await prisma.membership.findUnique({
            where: {
                userId_serverId: {
                    userId,
                    serverId
                }
            }
        });
        if (!membership) {
            return res.status(403).json({message: 'Accès refusé : Vous n\'êtes pas membre de ce serveur.'});

        }

        // membre, mais role non autorisé
        if (!allowedRoles.includes(membership.role)) {
            return res.status(403).json({message: 'Accès refusé : Rôle non autorisé pour cette action.'});
        }
        req.membership = membership; // on le passe à la suite pour éviter de refaire une requête si besoin
        next();
    } catch (error) {
      next (error);
    }
};