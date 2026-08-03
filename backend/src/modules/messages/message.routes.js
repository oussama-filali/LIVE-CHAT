import express from 'express';
import { getChannelMessages } from './message.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';

const router = express.Router();

// Corrigé : sans ça, n'importe qui pouvait lire les messages de n'importe
// quel salon sans être connecté
router.use(requireAuth);

router.get('/channel/:channelId', getChannelMessages);

export default router;