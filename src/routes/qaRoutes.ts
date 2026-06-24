import express from 'express';
import { getQAThreads, createQAThread, addReply, updateStatus, deleteQAThread } from '../controllers/qaController';
import { authenticate } from '../middlewares/auth';

const router = express.Router();

router.use(authenticate as any);

router.get('/', getQAThreads);
router.post('/', createQAThread);
router.post('/:id/reply', addReply);
router.patch('/:id/status', updateStatus);
router.delete('/:id', deleteQAThread);

export default router;
