import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth';
import { getCoupons, createCoupon, updateCoupon, deleteCoupon, verifyCoupon } from '../controllers/couponController';

const router = Router();

// Public route for website verification
router.post('/verify', verifyCoupon as any);

// Admin only routes for managing coupons
router.use(authenticate as any);
router.use(authorize('ADMIN') as any);

router.get('/', getCoupons as any);
router.post('/', createCoupon as any);
router.put('/:id', updateCoupon as any);
router.delete('/:id', deleteCoupon as any);

export default router;
