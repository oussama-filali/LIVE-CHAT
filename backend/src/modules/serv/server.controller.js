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

// 5. Envoyer une invitation de serveur
export const sendServerInvitation = async (req, res, next) => {
  try {
    const senderId = req.user.sub;
    const { serverId, receiverId } = req.body;

    if (!serverId || !receiverId) {
      return res.status(400).json({ error: 'serverId et receiverId sont requis' });
    }

    // Vérifier que l'expéditeur fait partie du serveur
    const isMember = await prisma.membership.findUnique({
      where: {
        userId_serverId: {
          userId: senderId,
          serverId,
        },
      },
    });

    if (!isMember) {
      return res.status(403).json({ error: 'Vous ne faites pas partie de ce serveur pour y inviter quelqu\'un' });
    }

    // Vérifier que le destinataire n'est pas déjà membre
    const isAlreadyMember = await prisma.membership.findUnique({
      where: {
        userId_serverId: {
          userId: receiverId,
          serverId,
        },
      },
    });

    if (isAlreadyMember) {
      return res.status(409).json({ error: 'Cet utilisateur est déjà membre de ce serveur' });
    }

    // Créer ou récupérer l'invitation existante si elle est PENDING
    const invitation = await prisma.serverInvitation.upsert({
      where: {
        serverId_receiverId: {
          serverId,
          receiverId,
        },
      },
      update: {
        senderId,
        status: 'PENDING',
        createdAt: new Date(),
      },
      create: {
        serverId,
        senderId,
        receiverId,
        status: 'PENDING',
      },
    });

    // Récupérer l'invitation complète avec les relations (serveur, salons, expéditeur)
    const fullInvitation = await prisma.serverInvitation.findUnique({
      where: { id: invitation.id },
      include: {
        server: {
          include: {
            channels: true,
          },
        },
        sender: {
          select: {
            username: true,
            email: true,
          },
        },
      },
    });

    // Émettre l'événement temps réel via Socket.io au destinataire
    if (req.io) {
      req.io.of('/chat').to(`user:${receiverId}`).emit('server_invitation', fullInvitation);
    }

    res.status(201).json(fullInvitation);
  } catch (error) {
    next(error);
  }
};

// 6. Récupérer les invitations en attente pour l'utilisateur connecté
export const getPendingInvitations = async (req, res, next) => {
  try {
    const userId = req.user.sub;

    const invitations = await prisma.serverInvitation.findMany({
      where: {
        receiverId: userId,
        status: 'PENDING',
      },
      include: {
        server: {
          include: {
            channels: true,
          },
        },
        sender: {
          select: {
            username: true,
            email: true,
          },
        },
      },
    });

    res.status(200).json(invitations);
  } catch (error) {
    next(error);
  }
};

// 7. Accepter ou décliner une invitation de serveur
export const respondToInvitation = async (req, res, next) => {
  try {
    const userId = req.user.sub;
    const { id } = req.params;
    const { accept } = req.body; // true ou false

    if (accept === undefined) {
      return res.status(400).json({ error: 'Le champ accept est requis' });
    }

    const invitation = await prisma.serverInvitation.findUnique({
      where: { id },
    });

    if (!invitation || invitation.receiverId !== userId) {
      return res.status(404).json({ error: 'Invitation introuvable ou non autorisée' });
    }

    if (invitation.status !== 'PENDING') {
      return res.status(400).json({ error: 'Cette invitation a déjà été traitée' });
    }

    if (accept) {
      // 1. Mettre à jour l'invitation
      await prisma.serverInvitation.update({
        where: { id },
        data: { status: 'ACCEPTED' },
      });

      // 2. Ajouter aux membres
      await prisma.membership.create({
        data: {
          userId,
          serverId: invitation.serverId,
          role: 'MEMBER',
        },
      });

      res.status(200).json({ status: 'ACCEPTED', message: 'Invitation acceptée !' });
    } else {
      await prisma.serverInvitation.update({
        where: { id },
        data: { status: 'DECLINED' },
      });

      res.status(200).json({ status: 'DECLINED', message: 'Invitation déclinée.' });
    }
  } catch (error) {
    next(error);
  }
};