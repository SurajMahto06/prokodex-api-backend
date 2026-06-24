import express from 'express';
import { authenticate, authorize } from '../middlewares/auth';
import { getSettings, updateSettings } from '../controllers/settingsController';

const router = express.Router();

// GET /api/v1/settings
// Fetch global settings (open to all or admin only based on requirement, usually authenticated users)
router.get('/', authenticate as any, getSettings as any);

// PUT /api/v1/settings
// Update global settings (admin only)
router.put('/', authenticate as any, authorize('ADMIN') as any, updateSettings as any);

export default router;
