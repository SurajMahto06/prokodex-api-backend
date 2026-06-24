import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { getStats } from '../controllers/statsController';

const router = Router();

// Only authenticated admins can access stats
router.use(authenticate as any);
router.get('/', getStats);

export default router;
