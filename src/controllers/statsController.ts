import { Request, Response } from 'express';
import { prisma } from '../utils/db';

// GET /api/v1/stats
export const getStats = async (req: Request, res: Response) => {
  try {
    const [totalUsers, totalCourses, totalAssignments, pendingQA] = await Promise.all([
      prisma.user.count(),
      prisma.course.count(),
      prisma.assignment.count(),
      prisma.mentorshipQA.count({ where: { status: 'pending' } }),
    ]);

    res.status(200).json({
      totalUsers,
      totalCourses,
      totalAssignments,
      pendingQA,
    });
  } catch (error: any) {
    console.error('getStats error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
