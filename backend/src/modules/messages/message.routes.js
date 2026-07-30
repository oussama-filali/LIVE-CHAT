import { Router } from 'express';
import { getChannelMessages } from './message.controller.js';

const router = Router();

// Route : GET /api/messages/channel/:channelId
router.get('/channel/:channelId', getChannelMessages);

export default router;