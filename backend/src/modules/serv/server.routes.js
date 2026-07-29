import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import {
  createServer,
  joinServer,
  getUserServers,
  createChannel,
  updateMemberRole,
} from './server.controller.js';

const router = Router();

// Toutes les routes nécessitent d'être authentifié
router.use(requireAuth);

router.post('/', createServer);
router.post('/join', joinServer);
router.get('/me', getUserServers);
router.post('/:serverId/channels', createChannel);
router.patch('/:serverId/members/:targetUserId/role', updateMemberRole);

export default router;