import express from 'express';
import { createModule, updateModule, deleteModule } from '../controllers/moduleController';
import { authenticate } from '../middlewares/auth';

const router = express.Router();

router.post('/', authenticate, createModule);
router.put('/:id', authenticate, updateModule);
router.delete('/:id', authenticate, deleteModule);

export default router;
