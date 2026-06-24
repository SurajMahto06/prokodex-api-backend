import { Router, Request, Response } from 'express';
import { authenticate } from '../middlewares/auth';
import { prisma } from '../utils/db';

const router = Router();

router.use(authenticate as any);

// GET /api/v1/me/mentees
router.get('/mentees', async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        menteesRelation: {
          select: {
            mentee: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                progressPercentage: true,
                enrollments: { select: { course: { select: { id: true, title: true } } } }
              }
            }
          }
        }
      }
    });

    if (!user) return res.status(404).json({ message: 'User not found' });
    const mentees = user.menteesRelation.map((m: any) => ({
      ...m.mentee,
      enrolledCourses: m.mentee.enrollments.map((e: any) => e.course)
    }));
    res.status(200).json({ mentees });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/v1/me/mentors
router.get('/mentors', async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        mentorsRelation: {
          select: { mentor: { select: { id: true, name: true, email: true } } }
        }
      }
    });

    if (!user) return res.status(404).json({ message: 'User not found' });
    const mentors = user.mentorsRelation.map((m: any) => m.mentor);
    res.status(200).json({ mentors });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/v1/me/courses
router.get('/courses', async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        enrollments: { select: { course: { select: { id: true, title: true, thumbnail: true } } } },
        mentorCourses: { select: { course: { select: { id: true, title: true, thumbnail: true } } } }
      }
    });

    if (!user) return res.status(404).json({ message: 'User not found' });
    res.status(200).json({
      enrolledCourses: user.enrollments.map((e: any) => e.course),
      assignedCourses: user.mentorCourses.map((m: any) => m.course)
    });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
