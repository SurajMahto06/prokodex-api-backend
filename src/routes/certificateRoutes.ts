import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { 
  getCertificates, 
  issueCertificate, 
  revokeCertificate, 
  verifyCertificate 
} from '../controllers/certificateController';
import { authenticate, authorize } from '../middlewares/auth';

const router = Router();

const verifyLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 10, // limit each IP to 10 requests per windowMs
  message: { error: 'Too many verification attempts from this IP, please try again after a minute' },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Public route to verify certificate
router.get('/verify/:certificateId', verifyLimiter, verifyCertificate);

// Protected routes
router.use(authenticate);

// Get all certificates (Admin gets all, Student gets their own)
router.get('/', getCertificates);

// Issue a new certificate (Admin only)
router.post('/issue', authorize('ADMIN'), issueCertificate);

// Revoke a certificate (Admin only)
router.delete('/:id', authorize('ADMIN'), revokeCertificate);

export default router;
