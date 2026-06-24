import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';

// Extend Express Request interface to include user payload
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

import { prisma } from '../utils/db';

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let token = req.cookies?.token;

    // Fallback to Authorization header if no cookie is present
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      }
    }

    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const decoded = verifyToken(token) as any;
    req.user = decoded;

    const settings = await prisma.settings.findUnique({ where: { id: 'global' } });
    if (settings?.maintenanceMode && req.user.role !== 'ADMIN') {
      return res.status(503).json({ message: 'Platform is currently under maintenance. Active sessions are temporarily suspended.' });
    }

    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// Role-based authorization middleware
// Usage: authorize('ADMIN') or authorize('ADMIN', 'MENTOR')
export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
    }

    next();
  };
};
