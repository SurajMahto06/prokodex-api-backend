import { Router } from 'express';
import { login, logout, getMe, completeTopic } from '../controllers/authController';
import { authenticate } from '../middlewares/auth';
import { authLimiter } from '../middlewares/rateLimiter';

const router = Router();

router.post('/login', authLimiter, login as any);
router.post('/logout', logout as any);
router.get('/me', authenticate as any, getMe as any);
router.post('/me/complete-topic', authenticate as any, completeTopic as any);

export default router;
