import { Router } from 'express';
import { getBlogs, getBlogBySlug, createBlog, updateBlog, deleteBlog } from '../controllers/blogController';
import { authenticate, authorize } from '../middlewares/auth';

const router = Router();

// Public routes
router.get('/', getBlogs as any);
router.get('/:slug', getBlogBySlug as any);

// Protected routes (Admin only)
router.use(authenticate as any);
router.use(authorize('ADMIN') as any);

router.post('/', createBlog as any);
router.put('/:id', updateBlog as any);
router.delete('/:id', deleteBlog as any);

export default router;
