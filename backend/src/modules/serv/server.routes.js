import { Router } from 'express';
import { requireRole } from '../../middlewares/rbac.middleware.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import {
  createServer,
  joinServer,
  getUserServers,
  createChannel,
  updateMemberRole,
  sendServerInvitation,
  getPendingInvitations,
  respondToInvitation,
} from './server.controller.js';

const router = Router();

// Toutes les routes nécessitent d'être authentifié
router.use(requireAuth);

router.post('/', createServer);
router.post('/join', joinServer);
router.get('/me', getUserServers);
router.post('/:serverId/channels', requireRole('OWNER', 'ADMIN'), createChannel);
router.patch('/:serverId/members/:targetUserId/role', requireRole('OWNER'), updateMemberRole);

// Routes d'invitation de serveur
router.post('/invitations/send', sendServerInvitation);
router.get('/invitations/pending', getPendingInvitations);
router.post('/invitations/:id/respond', respondToInvitation);

export default router;