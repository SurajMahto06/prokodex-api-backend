import { Router } from 'express';
import { getUsers, getUserById, createUser, updateUser, deleteUser, syncMentors } from '../controllers/userController';
import { authenticate, authorize } from '../middlewares/auth';

const router = Router();

// All user routes require authentication and ADMIN role
router.use(authenticate as any);
router.use(authorize('ADMIN') as any);

router.get('/sync-mentors', syncMentors as any);
router.get('/', getUsers as any);
router.get('/:id', getUserById as any);
router.post('/', createUser as any);
router.put('/:id', updateUser as any);
router.delete('/:id', deleteUser as any);

export default router;
