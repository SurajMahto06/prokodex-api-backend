import express from 'express';
import { createTopic, updateTopic, deleteTopic, getTopicById } from '../controllers/topicController';
import { authenticate } from '../middlewares/auth';
import { uploadMiddleware } from '../middlewares/upload';

const router = express.Router();

const topicUploads = uploadMiddleware.fields([
  { name: 'video', maxCount: 1 },
  { name: 'pdf', maxCount: 1 },
  { name: 'cheatsheet', maxCount: 1 }
]);

router.get('/:id', authenticate, getTopicById);
router.post('/', authenticate, topicUploads, createTopic);
router.put('/:id', authenticate, topicUploads, updateTopic);
router.delete('/:id', authenticate, deleteTopic);

export default router;
