import { Request, Response } from 'express';
import { prisma } from '../utils/db';
import { uploadBase64ToCloudinary } from '../utils/cloudinary';

export const getQAThreads = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    const normalizedRole = String(role || '').toUpperCase();

    const page = req.query.page ? parseInt(req.query.page as string) : undefined;
    const per_page = req.query.per_page ? parseInt(req.query.per_page as string) : undefined;

    let whereClause: any = {};

    if (normalizedRole === 'STUDENT') {
      whereClause = { studentId: userId };
    } else if (normalizedRole === 'MENTOR') {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { mentorCourses: { select: { courseId: true } } }
      });
      const courseIds = user?.mentorCourses.map((m: any) => m.courseId) || [];
      whereClause = { courseId: { in: courseIds } };
    }

    const total = await prisma.mentorshipQA.count({ where: whereClause });
    const skip = page && per_page ? (page - 1) * per_page : undefined;
    const take = per_page;

    const threads = await prisma.mentorshipQA.findMany({
      where: whereClause,
      ...(skip !== undefined ? { skip } : {}),
      ...(take !== undefined ? { take } : {}),
      include: {
        student: { select: { id: true, name: true, avatarUrl: true, role: true } },
        course: { select: { id: true, title: true } },
        replies: {
          include: { author: { select: { id: true, name: true, avatarUrl: true, role: true } } },
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (page !== undefined && per_page !== undefined) {
      res.status(200).json({
        threads,
        hasMore: (skip || 0) + threads.length < total,
        total
      });
    } else {
      res.status(200).json(threads);
    }
  } catch (error) {
    console.error('Error fetching QA threads:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const createQAThread = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    const { courseId, question, imageUrls } = req.body;

    if (role !== 'STUDENT') {
      return res.status(403).json({ message: 'Only students can create questions' });
    }

    if (!courseId || !question) {
      return res.status(400).json({ message: 'courseId and question are required' });
    }

    let uploadedImageUrls: string[] = [];
    if (imageUrls && Array.isArray(imageUrls)) {
      uploadedImageUrls = await Promise.all(
        imageUrls.map(async (img: string) => {
          if (img && img.startsWith('data:image')) {
            return await uploadBase64ToCloudinary(img, 'qa_images');
          }
          return img;
        })
      );
    }

    const newThread = await prisma.mentorshipQA.create({
      data: {
        studentId: userId,
        courseId,
        question,
        imageUrls: uploadedImageUrls as any
      },
      include: {
        student: { select: { id: true, name: true, avatarUrl: true, role: true } },
        course: { select: { id: true, title: true } },
        replies: {
          include: { author: { select: { id: true, name: true, avatarUrl: true, role: true } } }
        }
      }
    });

    // Notify Mentors asynchronously
    try {
      const studentWithMentors = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true }
      });
      const courseWithMentors = await prisma.course.findUnique({
        where: { id: courseId },
        select: { title: true }
      });

      // Find course mentors and student mentors directly
      const courseMentors = await prisma.user.findMany({
        where: {
          role: 'MENTOR',
          mentorCourses: {
            some: { courseId: courseId }
          }
        },
        select: { id: true }
      });

      const studentMentors = await prisma.user.findMany({
        where: {
          role: 'MENTOR',
          menteesRelation: {
            some: { menteeId: userId }
          }
        },
        select: { id: true }
      });

      const mentorIds = new Set<string>();
      courseMentors.forEach(m => mentorIds.add(m.id));
      studentMentors.forEach(m => mentorIds.add(m.id));

      const questionSnippet = question.slice(0, 60) + (question.length > 60 ? '...' : '');

      for (const mentorId of mentorIds) {
        await prisma.appNotification.create({
          data: {
            userId: mentorId,
            title: 'New Doubt Posted',
            message: `${studentWithMentors?.name || 'A student'} asked: "${questionSnippet}" in ${courseWithMentors?.title || 'Course'}`,
            type: 'info'
          }
        });
      }
    } catch (notifErr) {
      console.error('Failed to create notifications for thread creation:', notifErr);
    }

    res.status(201).json(newThread);
  } catch (error) {
    console.error('Error creating QA thread:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const addReply = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const id = req.params.id as string;
    const { content, imageUrls } = req.body;

    if (!content) {
      return res.status(400).json({ message: 'Reply content is required' });
    }

    const thread = await prisma.mentorshipQA.findUnique({
      where: { id },
      include: {
        student: { select: { id: true, name: true } },
        course: { select: { id: true, title: true } }
      }
    });

    if (!thread) {
      return res.status(404).json({ message: 'QA thread not found' });
    }

    let uploadedImageUrls: string[] = [];
    if (imageUrls && Array.isArray(imageUrls)) {
      uploadedImageUrls = await Promise.all(
        imageUrls.map(async (img: string) => {
          if (img && img.startsWith('data:image')) {
            return await uploadBase64ToCloudinary(img, 'qa_images');
          }
          return img;
        })
      );
    }

    const reply = await prisma.qAReply.create({
      data: {
        qaThreadId: id,
        authorId: userId,
        content,
        imageUrls: uploadedImageUrls as any
      },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true, role: true } }
      }
    });

    // Update thread status based on who replied
    try {
      const author = reply.author;
      const normalizedRole = String(author?.role || '').toUpperCase();
      const newStatus = (normalizedRole === 'MENTOR' || normalizedRole === 'ADMIN') ? 'answered' : 'pending';

      await prisma.mentorshipQA.update({
        where: { id },
        data: { status: newStatus }
      });

      const replySnippet = content.slice(0, 60) + (content.length > 60 ? '...' : '');

      if (normalizedRole === 'MENTOR' || normalizedRole === 'ADMIN') {
        // Notify the student
        await prisma.appNotification.create({
          data: {
            userId: thread.studentId,
            title: 'Mentor Replied to your Doubt',
            message: `${author?.name || 'Mentor'} replied: "${replySnippet}"`,
            type: 'success'
          }
        });
      } else {
        // Student replied, notify associated mentors
        const courseMentors = await prisma.user.findMany({
          where: {
            role: 'MENTOR',
            mentorCourses: {
              some: { courseId: thread.courseId }
            }
          },
          select: { id: true }
        });

        const studentMentors = await prisma.user.findMany({
          where: {
            role: 'MENTOR',
            menteesRelation: {
              some: { menteeId: thread.studentId }
            }
          },
          select: { id: true }
        });

        const mentorIds = new Set<string>();
        courseMentors.forEach(m => mentorIds.add(m.id));
        studentMentors.forEach(m => mentorIds.add(m.id));

        for (const mentorId of mentorIds) {
          if (mentorId !== userId) { // Don't notify the replier
            await prisma.appNotification.create({
              data: {
                userId: mentorId,
                title: 'Student Replied to Doubt',
                message: `${author?.name || 'Student'} replied: "${replySnippet}"`,
                type: 'info'
              }
            });
          }
        }
      }
    } catch (notifErr) {
      console.error('Failed to create notifications for QA reply:', notifErr);
    }

    res.status(201).json(reply);
  } catch (error) {
    console.error('Error adding reply:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateStatus = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { status } = req.body;
    const role = req.user.role;

    if (role === 'STUDENT') {
      return res.status(403).json({ message: 'Students cannot update status' });
    }

    if (!['pending', 'answered'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const updatedThread = await prisma.mentorshipQA.update({
      where: { id },
      data: { status },
      include: {
        student: { select: { id: true, name: true, avatarUrl: true, role: true } },
        course: { select: { id: true, title: true } },
        replies: {
          include: { author: { select: { id: true, name: true, avatarUrl: true, role: true } } }
        }
      }
    });

    res.status(200).json(updatedThread);
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const deleteQAThread = async (req: Request, res: Response) => {
  try {
    const threadId = req.params.id as string;
    const userId = req.user.id;
    const role = req.user.role;
    const normalizedRole = String(role || '').toUpperCase();

    // 1. Fetch thread to check associations
    const thread = await prisma.mentorshipQA.findUnique({
      where: { id: threadId }
    });

    if (!thread) {
      return res.status(404).json({ message: 'QA thread not found' });
    }

    // 2. Authorization check
    if (normalizedRole === 'ADMIN') {
      // Admin can delete any thread
    } else if (normalizedRole === 'MENTOR') {
      // Mentor can delete if thread is assigned to their courses or mentees
      const mentorWithRel = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          mentorCourses: { select: { courseId: true } },
          menteesRelation: { select: { menteeId: true } }
        }
      });

      const isCourseAssigned = mentorWithRel?.mentorCourses.some((c: any) => c.courseId === thread.courseId);
      const isMenteeAssigned = mentorWithRel?.menteesRelation.some((m: any) => m.menteeId === thread.studentId);

      if (!isCourseAssigned && !isMenteeAssigned) {
        return res.status(403).json({ message: 'Permission denied: This discussion does not belong to your assigned courses or mentees.' });
      }
    } else {
      // Students cannot delete discussion threads
      return res.status(403).json({ message: 'Permission denied: Students are not allowed to delete discussion threads.' });
    }

    // 3. Delete the thread (cascades deletes to replies due to Prisma schema setup)
    await prisma.mentorshipQA.delete({
      where: { id: threadId }
    });

    res.status(200).json({ message: 'Discussion thread deleted successfully' });
  } catch (error) {
    console.error('Error deleting QA thread:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
