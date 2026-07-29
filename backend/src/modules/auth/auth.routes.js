import {Router} from 'express';
import { register, login, logout, refresh } from './auth.controller.js';
import { authLimiter }  from '../../middlewares/rateLimiter.middleware.js';

const router = Router();

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/refresh', refresh);
router.post('/logout', logout);

export default router;
