import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import {
  getConversations,
  createConversation,
  getConversationMessages,
  deleteConversation,
  searchUsers,
} from './conversation.controller.js';

const router = Router();

// Toutes les routes de conversation nécessitent une authentification
router.use(requireAuth);

router.get('/', getConversations);
router.post('/', createConversation);
router.get('/search', searchUsers);
router.get('/:id/messages', getConversationMessages);
router.delete('/:id', deleteConversation);

export default router;
