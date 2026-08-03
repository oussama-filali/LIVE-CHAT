import { prisma } from '../../config/postgres.js';

// 1. Créer un serveur
export const createServer = async (req, res, next) => {
  try {
    const { name } = req.body;
    const userId = req.user.sub;

    if (!name) {
      return res.status(400).json({ error: 'Le nom du serveur est requis' });
    }

    // Création du serveur
    const server = await prisma.server.create({
      data: {
        name,
        ownerId: userId,
      },
    });

    // Ajout du créateur comme OWNER
    await prisma.membership.create({
      data: {
        userId,
        serverId: server.id,
        role: 'OWNER',
      },
    });

    // Création du salon textuel par défaut (#general)
    await prisma.channel.create({
      data: {
        name: 'general',
        type: 'TEXT',
        serverId: server.id,
      },
    });

    res.status(201).json(server);
  } catch (error) {
    next(error);
  }
};

// 2. Rejoindre un serveur avec le code d'invitation
export const joinServer = async (req, res, next) => {
  try {
    const { inviteCode } = req.body;
    const userId = req.user.sub;

    if (!inviteCode) {
      return res.status(400).json({ error: 'Le code d\'invitation est requis' });
    }

    const server = await prisma.server.findUnique({
      where: { inviteCode },
    });

    if (!server) {
      return res.status(404).json({ error: 'Code d invitation invalide' });
    }

    // Ajouter l'utilisateur aux membres
    await prisma.membership.create({
      data: {
        userId,
        serverId: server.id,
        role: 'MEMBER',
      },
    });

    res.status(200).json({ message: 'Serveur rejoint !', server });
  } catch (error) {
    // Si l'utilisateur est déjà membre, Prisma lève une erreur de contrainte
    // unique (P2002) : on renvoie un message clair plutôt qu'un 500 générique
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Tu es déjà membre de ce serveur' });
    }
    next(error);
  }
};

// Récupérer les serveurs de l'utilisateur connecté
export const getUserServers = async (req, res, next) => {
  try {
    const userId = req.user.sub;

    const memberships = await prisma.membership.findMany({
      where: { userId },
      include: {
        server: {
          include: { channels: true },
        },
      },
    });

    res.status(200).json(memberships);
  } catch (error) {
    next(error);
  }
};

// Créer un salon
export const createChannel = async (req, res, next) => {
  try {
    const { serverId } = req.params;
    const { name, type } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Le nom du salon est requis' });
    }

    const channel = await prisma.channel.create({
      data: {
        name,
        type: type || 'TEXT',
        serverId,
      },
    });

    res.status(201).json(channel);
  } catch (error) {
    next(error);
  }
};

// Modifier role
export const updateMemberRole = async (req, res, next) => {
  try {
    const { serverId, targetUserId } = req.params;
    const { role } = req.body; // 'ADMIN' ou 'MEMBER'

    const updatedMember = await prisma.membership.update({
      where: {
        userId_serverId: {
          userId: targetUserId,
          serverId,
        },
      },
      data: { role },
    });

    res.status(200).json(updatedMember);
  } catch (error) {
    next(error);
  }
};