import express from 'express';
import { getCourses, getCourseById, createCourse, updateCourse, deleteCourse } from '../controllers/courseController';
import { authenticate } from '../middlewares/auth';
import { uploadMiddleware } from '../middlewares/upload';

const router = express.Router();

router.get('/', authenticate, getCourses);
router.get('/:id', authenticate, getCourseById);
router.post('/', authenticate, uploadMiddleware.single('thumbnail'), createCourse);
router.put('/:id', authenticate, uploadMiddleware.single('thumbnail'), updateCourse);
router.delete('/:id', authenticate, deleteCourse);

export default router;
