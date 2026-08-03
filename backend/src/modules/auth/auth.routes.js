import {Router} from 'express';
import { register, login, logout, refresh, me } from './auth.controller.js';
import { authLimiter }  from '../../middlewares/rateLimiter.middleware.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';

const router = Router();

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', requireAuth, me);

export default router;