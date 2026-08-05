import { prisma } from '../../config/postgres.js';
import { PrivateMessage } from '../messages/privateMessage.model.js';

/**
 * Récupère la liste des conversations de l'utilisateur connecté.
 */
export const getConversations = async (req, res, next) => {
  try {
    const currentUserId = req.user.sub;

    const userConversations = await prisma.conversationParticipant.findMany({
      where: {
        userId: currentUserId,
        isVisible: true,
      },
      include: {
        conversation: {
          include: {
            participants: {
              where: {
                userId: { not: currentUserId },
              },
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    email: true,
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const result = await Promise.all(
      userConversations.map(async (part) => {
        const otherParticipant = part.conversation.participants[0]?.user;
        
        // Récupérer le dernier message de cette conversation
        const lastMessage = await PrivateMessage.findOne({ conversationId: part.conversationId })
          .sort({ createdAt: -1 })
          .exec();

        return {
          id: part.conversationId,
          createdAt: part.conversation.createdAt,
          updatedAt: part.conversation.updatedAt,
          recipient: otherParticipant || null,
          lastMessage: lastMessage
            ? {
                id: lastMessage._id,
                senderId: lastMessage.senderId,
                senderName: lastMessage.senderName,
                content: lastMessage.content,
                createdAt: lastMessage.createdAt,
              }
            : null,
        };
      })
    );

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Crée ou réactive une conversation avec un destinataire.
 */
export const createConversation = async (req, res, next) => {
  try {
    const currentUserId = req.user.sub;
    const { recipientId } = req.body;

    if (!recipientId) {
      return res.status(400).json({ error: 'Le paramètre recipientId est requis.' });
    }

    if (recipientId === currentUserId) {
      return res.status(400).json({ error: 'Vous ne pouvez pas créer une conversation avec vous-même.' });
    }

    // Vérifier que le destinataire existe
    const recipient = await prisma.user.findUnique({
      where: { id: recipientId },
      select: {
        id: true,
        username: true,
        email: true,
        avatarUrl: true,
      },
    });

    if (!recipient) {
      return res.status(404).json({ error: 'Destinataire introuvable.' });
    }

    // Vérifier si une conversation existe déjà entre les deux participants
    const existingConversation = await prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { userId: currentUserId } } },
          { participants: { some: { userId: recipientId } } },
        ],
      },
      include: {
        participants: true,
      },
    });

    if (existingConversation) {
      // S'assurer que isVisible passe à true pour les deux participants
      await prisma.conversationParticipant.updateMany({
        where: {
          conversationId: existingConversation.id,
          userId: { in: [currentUserId, recipientId] },
        },
        data: {
          isVisible: true,
        },
      });

      // Récupérer le dernier message
      const lastMessage = await PrivateMessage.findOne({ conversationId: existingConversation.id })
        .sort({ createdAt: -1 })
        .exec();

      return res.status(200).json({
        id: existingConversation.id,
        createdAt: existingConversation.createdAt,
        updatedAt: existingConversation.updatedAt,
        recipient,
        lastMessage: lastMessage
          ? {
              id: lastMessage._id,
              senderId: lastMessage.senderId,
              senderName: lastMessage.senderName,
              content: lastMessage.content,
              createdAt: lastMessage.createdAt,
            }
          : null,
      });
    }

    // Créer une nouvelle conversation
    const newConversation = await prisma.conversation.create({
      data: {
        participants: {
          create: [
            { userId: currentUserId, isVisible: true },
            { userId: recipientId, isVisible: true },
          ],
        },
      },
    });

    res.status(201).json({
      id: newConversation.id,
      createdAt: newConversation.createdAt,
      updatedAt: newConversation.updatedAt,
      recipient,
      lastMessage: null,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Récupère les messages d'une conversation, filtrés par lastDeletedAt.
 */
export const getConversationMessages = async (req, res, next) => {
  try {
    const currentUserId = req.user.sub;
    const { id: conversationId } = req.params;

    // Vérifier que la conversation existe et que l'utilisateur y participe
    const participant = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: currentUserId,
        },
      },
    });

    if (!participant) {
      return res.status(403).json({ error: 'Accès non autorisé à cette conversation ou conversation introuvable.' });
    }

    // Filtrer les messages créés après lastDeletedAt (si défini)
    const query = { conversationId };
    if (participant.lastDeletedAt) {
      query.createdAt = { $gt: participant.lastDeletedAt };
    }

    const messages = await PrivateMessage.find(query)
      .sort({ createdAt: 1 })
      .exec();

    res.status(200).json(messages);
  } catch (error) {
    next(error);
  }
};

/**
 * Soft-delete d'une conversation (masquer pour l'utilisateur connecté).
 */
export const deleteConversation = async (req, res, next) => {
  try {
    const currentUserId = req.user.sub;
    const { id: conversationId } = req.params;

    // Vérifier que l'utilisateur participe à la conversation
    const participant = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: currentUserId,
        },
      },
    });

    if (!participant) {
      return res.status(404).json({ error: 'Conversation introuvable ou accès non autorisé.' });
    }

    // Mettre à jour isVisible à false et lastDeletedAt à maintenant
    await prisma.conversationParticipant.update({
      where: {
        id: participant.id,
      },
      data: {
        isVisible: false,
        lastDeletedAt: new Date(),
      },
    });

    res.status(200).json({ message: 'Conversation masquée avec succès.' });
  } catch (error) {
    next(error);
  }
};

/**
 * Recherche des utilisateurs par nom d'utilisateur ou email (exclut l'utilisateur connecté).
 */
export const searchUsers = async (req, res, next) => {
  try {
    const currentUserId = req.user.sub;
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Le paramètre de recherche q est requis.' });
    }

    const users = await prisma.user.findMany({
      where: {
        id: { not: currentUserId },
        OR: [
          { username: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        username: true,
        email: true,
        avatarUrl: true,
      },
    });

    res.status(200).json(users);
  } catch (error) {
    next(error);
  }
};
