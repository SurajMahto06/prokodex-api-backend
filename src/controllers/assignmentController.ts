import { Request, Response } from 'express';
import { prisma } from '../utils/db';

export const assignmentController = {
  // GET /api/v1/assignments
  async getAssignments(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const role = req.user?.role;

      const page = parseInt(req.query.page as string) || 1;
      const requestedLimit = parseInt(req.query.per_page as string) || 20;
      const per_page = Math.min(requestedLimit, 100); // Hard cap at 100
      const search = req.query.search as string || "";
      const skip = (page - 1) * per_page;

      let whereClause: any = {};

      if (role === 'STUDENT') {
        whereClause.studentId = userId;
      } else if (role === 'MENTOR') {
        whereClause.mentorId = userId;
      }

      if (search) {
        whereClause.OR = [
          { title: { contains: search } },
          { student: { name: { contains: search } } },
          { course: { title: { contains: search } } }
        ];
      }

      const [assignments, total] = await Promise.all([
        prisma.assignment.findMany({
          where: whereClause,
          include: {
            course: { select: { id: true, title: true } },
            student: { select: { id: true, name: true, email: true, avatarUrl: true } },
            mentor: { select: { id: true, name: true, email: true, avatarUrl: true } },
          },
          orderBy: { assignedAt: 'desc' },
          skip,
          take: per_page
        }),
        prisma.assignment.count({ where: whereClause })
      ]);

      const totalPages = Math.ceil(total / per_page);

      res.status(200).json({
        data: assignments,
        total,
        page,
        totalPages,
        per_page
      });
    } catch (error) {
      console.error('Error fetching assignments:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  // GET /api/v1/assignments/:id
  async getAssignmentById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const role = req.user?.role;

      const assignment = await prisma.assignment.findUnique({
        where: { id: id as string },
        include: {
          course: { select: { id: true, title: true } },
          student: { select: { id: true, name: true, email: true, avatarUrl: true } },
          mentor: { select: { id: true, name: true, email: true, avatarUrl: true } },
        }
      });

      if (!assignment) {
        return res.status(404).json({ message: 'Assignment not found' });
      }

      // Permissions check
      if (role === 'STUDENT' && assignment.studentId !== userId) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      if (role === 'MENTOR' && assignment.mentorId !== userId) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      res.status(200).json(assignment);
    } catch (error) {
      console.error('Error fetching assignment:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  // POST /api/v1/assignments
  async createAssignment(req: Request, res: Response) {
    try {
      const { studentId, courseId, title, description, dueDate } = req.body;
      const mentorId = req.user?.id;
      const role = req.user?.role;

      if (role === 'STUDENT') {
        return res.status(403).json({ message: 'Students cannot create assignments' });
      }

      if (!studentId || !courseId || !title || !description) {
        return res.status(400).json({ message: 'Missing required fields' });
      }

      const assignment = await prisma.assignment.create({
        data: {
          studentId,
          courseId,
          title,
          description,
          mentorId: mentorId as string,
          dueDate: dueDate ? new Date(dueDate) : null,
          status: 'pending_submission'
        },
        include: {
          course: { select: { id: true, title: true } },
          student: { select: { id: true, name: true } },
          mentor: { select: { id: true, name: true } },
        }
      });

      // Notify student about new assignment
      try {
        await prisma.appNotification.create({
          data: {
            userId: studentId,
            title: 'New Assignment Assigned',
            message: `Mentor ${assignment.mentor.name} assigned you a new assignment: "${title}" for ${assignment.course.title}`,
            type: 'info'
          }
        });
      } catch (notifErr) {
        console.error('Failed to create notification for assignment creation:', notifErr);
      }

      res.status(201).json({ message: 'Assignment created successfully', assignment });
    } catch (error) {
      console.error('Error creating assignment:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  // PUT /api/v1/assignments/:id
  async updateAssignment(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { title, description, dueDate, status } = req.body;
      const role = req.user?.role;
      const userId = req.user?.id;

      if (role === 'STUDENT') {
        return res.status(403).json({ message: 'Students cannot update assignment details directly. Use submit endpoint.' });
      }

      const existingAssignment = await prisma.assignment.findUnique({ where: { id: id as string } });
      if (!existingAssignment) return res.status(404).json({ message: 'Assignment not found' });
      if (role === 'MENTOR' && existingAssignment.mentorId !== userId) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const assignment = await prisma.assignment.update({
        where: { id: id as string },
        data: {
          title,
          description,
          dueDate: dueDate ? new Date(dueDate) : undefined,
          status
        },
        include: {
          course: { select: { id: true, title: true } },
          student: { select: { id: true, name: true } },
          mentor: { select: { id: true, name: true } },
        }
      });

      // Notify student if assignment status is updated (e.g. approved or rejected)
      if (status && status !== existingAssignment.status) {
        try {
          let type = 'info';
          let titleText = 'Assignment Updated';
          if (status === 'approved') {
            type = 'success';
            titleText = 'Assignment Approved 🎉';
          } else if (status === 'rejected') {
            type = 'warning';
            titleText = 'Assignment Needs Revision';
          }
          await prisma.appNotification.create({
            data: {
              userId: assignment.studentId,
              title: titleText,
              message: `Your assignment "${assignment.title}" has been ${status.replace('_', ' ')} by your mentor.`,
              type
            }
          });
        } catch (notifErr) {
          console.error('Failed to create notification for assignment update:', notifErr);
        }
      }

      res.status(200).json({ message: 'Assignment updated successfully', assignment });
    } catch (error) {
      console.error('Error updating assignment:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  // PUT /api/v1/assignments/:id/submit
  async submitAssignment(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { repoUrl, fileName, fileUrl } = req.body;
      const userId = req.user?.id;

      const existingAssignment = await prisma.assignment.findUnique({ where: { id: id as string } });
      if (!existingAssignment) return res.status(404).json({ message: 'Assignment not found' });

      if (existingAssignment.studentId !== userId && req.user?.role !== 'ADMIN') {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const assignment = await prisma.assignment.update({
        where: { id: id as string },
        data: {
          repoUrl,
          fileName,
          fileUrl,
          status: 'submitted',
          submittedAt: new Date()
        },
        include: {
          course: { select: { id: true, title: true } },
          student: { select: { id: true, name: true } },
          mentor: { select: { id: true, name: true } },
        }
      });

      // Notify mentor about assignment submission
      try {
        await prisma.appNotification.create({
          data: {
            userId: assignment.mentorId,
            title: 'Assignment Submitted',
            message: `Student ${assignment.student.name} submitted assignment: "${assignment.title}"`,
            type: 'success'
          }
        });
      } catch (notifErr) {
        console.error('Failed to create notification for assignment submission:', notifErr);
      }

      res.status(200).json({ message: 'Assignment submitted successfully', assignment });
    } catch (error) {
      console.error('Error submitting assignment:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },
  // trigger restart

  // DELETE /api/v1/assignments/:id
  async deleteAssignment(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const role = req.user?.role;
      const userId = req.user?.id;

      if (role === 'STUDENT') {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const existingAssignment = await prisma.assignment.findUnique({ where: { id: id as string } });
      if (!existingAssignment) return res.status(404).json({ message: 'Assignment not found' });

      if (role === 'MENTOR' && existingAssignment.mentorId !== userId) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      await prisma.assignment.delete({ where: { id: id as string } });

      res.status(200).json({ message: 'Assignment deleted successfully' });
    } catch (error) {
      console.error('Error deleting assignment:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
};
