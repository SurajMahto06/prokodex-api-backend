import { Request, Response } from 'express';
import { prisma } from '../utils/db';
import bcrypt from 'bcrypt';

const formatUserResponse = (user: any) => {
  const { password, mentorCourses, enrollments, ...userWithoutPassword } = user;
  const result: any = { ...userWithoutPassword };
  if (mentorCourses) {
    result.assignedCourses = mentorCourses.map((m: any) => m.course || { id: m.courseId });
  }
  if (enrollments) {
    result.enrolledCourses = enrollments.map((e: any) => e.course || { id: e.courseId });
  }
  return result;
};

// GET /api/users/sync-mentors
export const syncMentors = async (req: Request, res: Response) => {
  try {
    const mentors = await prisma.user.findMany({
      where: { role: 'MENTOR' },
      include: { mentorCourses: true }
    });

    const students = await prisma.user.findMany({
      where: { role: 'STUDENT' },
      include: { enrollments: true }
    });

    let syncedCount = 0;

    for (const mentor of mentors) {
      const assignedCourseIds = mentor.mentorCourses.map((c: any) => c.courseId);
      if (assignedCourseIds.length === 0) continue;

      const overlappingStudents = students.filter(student => 
        student.enrollments.some((e: any) => assignedCourseIds.includes(e.courseId))
      );

      if (overlappingStudents.length > 0) {
        // Clear old ones first to avoid unique constraint errors
        await prisma.mentorship.deleteMany({
          where: { mentorId: mentor.id }
        });
        await prisma.user.update({
          where: { id: mentor.id },
          data: {
            menteesRelation: {
              create: overlappingStudents.map(s => ({ menteeId: s.id }))
            }
          }
        });
        syncedCount++;
      }
    }

    for (const student of students) {
      const enrolledCourseIds = student.enrollments.map((c: any) => c.courseId);
      if (enrolledCourseIds.length === 0) continue;

      const overlappingMentors = mentors.filter(mentor => 
        mentor.mentorCourses.some((course: any) => enrolledCourseIds.includes(course.courseId))
      );

      if (overlappingMentors.length > 0) {
        await prisma.mentorship.deleteMany({
          where: { menteeId: student.id }
        });
        await prisma.user.update({
          where: { id: student.id },
          data: {
            mentorsRelation: {
              create: overlappingMentors.map(m => ({ mentorId: m.id }))
            }
          }
        });
      }
    }

    res.status(200).json({ message: `Sync completed! Updated relations for ${syncedCount} mentors.` });
  } catch (error: any) {
    console.error('Sync error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// GET /api/users
export const getUsers = async (req: Request, res: Response) => {
  try {
    const { role, status, search, paginate } = req.query;
    const isPaginated = paginate !== 'false';
    
    // Pagination parameters
    const page = parseInt(req.query.page as string) || 1;
    const requestedLimit = parseInt(req.query.per_page as string) || 20;
    const per_page = Math.min(requestedLimit, 100); // Hard cap at 100
    const skip = (page - 1) * per_page;

    // Build the where clause
    const whereClause: any = {};

    if (role) {
      whereClause.role = String(role).toUpperCase();
    }

    if (status) {
      whereClause.status = String(status);
    }

    if (search) {
      const searchStr = String(search);
      whereClause.OR = [
        { name: { contains: searchStr } },
        { email: { contains: searchStr } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: whereClause,
        include: {
          enrollments: { select: { courseId: true } },
          mentorCourses: { select: { courseId: true } },
        },
        orderBy: { createdAt: 'desc' },
        ...(isPaginated ? { skip, take: per_page } : {})
      }),
      prisma.user.count({ where: whereClause })
    ]);

    const formattedUsers = users.map(user => formatUserResponse(user));
    const totalPages = isPaginated ? Math.ceil(total / per_page) : 1;

    res.status(200).json({
      data: formattedUsers,
      total,
      page: isPaginated ? page : 1,
      totalPages,
      per_page: isPaginated ? per_page : total
    });
  } catch (error: any) {
    console.error('GetUsers error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// GET /api/users/:id
export const getUserById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: id as string },
      include: {
        enrollments: { select: { course: { select: { id: true, title: true } } } },
        mentorCourses: { select: { course: { select: { id: true, title: true } } } },
        menteesRelation: { select: { mentee: { select: { id: true, name: true, email: true } } } },
        mentorsRelation: { select: { mentor: { select: { id: true, name: true, email: true } } } },
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const formattedUser: any = { ...user };
    if (user.enrollments) formattedUser.enrolledCourses = user.enrollments.map((e: any) => e.course);
    if (user.mentorCourses) formattedUser.assignedCourses = user.mentorCourses.map((m: any) => m.course);
    if (user.menteesRelation) formattedUser.mentees = user.menteesRelation.map((m: any) => m.mentee);
    if (user.mentorsRelation) formattedUser.mentors = user.mentorsRelation.map((m: any) => m.mentor);
    delete formattedUser.enrollments;
    delete formattedUser.mentorCourses;
    delete formattedUser.menteesRelation;
    delete formattedUser.mentorsRelation;

    res.status(200).json(formatUserResponse(formattedUser));
  } catch (error: any) {
    console.error('GetUserById error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// POST /api/users
// Note: Can also use authController.register, but this allows admin specific overrides
export const createUser = async (req: Request, res: Response) => {
  try {
    const { email, password, name, role, plan, status, enrolledCourseIds, assignedCourseIds } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ message: 'Email, password, and name are required' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userRole = role ? String(role).toUpperCase() : 'STUDENT';

    let overlappingMentors: { id: string }[] = [];
    let overlappingStudents: { id: string }[] = [];

    if (userRole === 'STUDENT' && enrolledCourseIds && enrolledCourseIds.length > 0) {
      overlappingMentors = await prisma.user.findMany({
        where: {
          role: 'MENTOR',
          mentorCourses: { some: { courseId: { in: enrolledCourseIds } } }
        },
        select: { id: true }
      });
    } else if (userRole === 'MENTOR' && assignedCourseIds && assignedCourseIds.length > 0) {
      overlappingStudents = await prisma.user.findMany({
        where: {
          role: 'STUDENT',
          enrollments: { some: { courseId: { in: assignedCourseIds } } }
        },
        select: { id: true }
      });
    }

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: userRole as any,
        plan: plan || null,
        status: status || 'active',
        // Connect to enrolled courses (for students)
        ...(userRole === 'STUDENT' && enrolledCourseIds && enrolledCourseIds.length > 0 && {
          enrollments: {
            create: enrolledCourseIds.map((id: string) => ({ courseId: id })),
          },
        }),
        // Connect to assigned projects (for mentors)
        ...(userRole === 'MENTOR' && assignedCourseIds && assignedCourseIds.length > 0 && {
          mentorCourses: {
            create: assignedCourseIds.map((id: string) => ({ courseId: id })),
          },
        }),
        // Connect to mentors automatically (for students)
        ...(overlappingMentors.length > 0 && {
          mentorsRelation: {
            create: overlappingMentors.map(m => ({ mentorId: m.id })),
          },
        }),
        // Connect to mentees automatically (for mentors)
        ...(overlappingStudents.length > 0 && {
          menteesRelation: {
            create: overlappingStudents.map(s => ({ menteeId: s.id })),
          },
        }),
      },
      include: {
        enrollments: { select: { course: { select: { id: true, title: true } } } },
        mentorCourses: { select: { course: { select: { id: true, title: true } } } },
      },
    });

    res.status(201).json({
      message: 'User created successfully',
      user: formatUserResponse(user),
    });
  } catch (error: any) {
    console.error('CreateUser error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// PUT /api/users/:id
export const updateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { email, name, role, plan, status, enrolledCourseIds, assignedCourseIds, password } = req.body;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { id: id as string } });
    if (!existingUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const updateData: any = {};

    if (email) updateData.email = email;
    if (name) updateData.name = name;
    if (role) updateData.role = String(role).toUpperCase();
    if (plan !== undefined) updateData.plan = plan;
    if (status) updateData.status = status;
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    // Handle relations if provided
    if (enrolledCourseIds !== undefined) {
      // For explicit relations, delete old and create new
      await prisma.courseEnrollment.deleteMany({ where: { userId: id as string } });
      if (enrolledCourseIds.length > 0) {
        updateData.enrollments = {
          create: enrolledCourseIds.map((courseId: string) => ({ courseId })),
        };
      }
    }

    if (assignedCourseIds !== undefined) {
      await prisma.mentorCourse.deleteMany({ where: { mentorId: id as string } });
      if (assignedCourseIds.length > 0) {
        updateData.mentorCourses = {
          create: assignedCourseIds.map((courseId: string) => ({ courseId })),
        };
      }
    }

    const targetRole = updateData.role || existingUser.role;

    if (targetRole === 'STUDENT' && enrolledCourseIds !== undefined) {
      const overlappingMentors = await prisma.user.findMany({
        where: { role: 'MENTOR', mentorCourses: { some: { courseId: { in: enrolledCourseIds } } } },
        select: { id: true }
      });
      await prisma.mentorship.deleteMany({ where: { menteeId: id as string } });
      if (overlappingMentors.length > 0) {
        updateData.mentorsRelation = { create: overlappingMentors.map(m => ({ mentorId: m.id })) };
      }
    } else if (targetRole === 'MENTOR' && assignedCourseIds !== undefined) {
      const overlappingStudents = await prisma.user.findMany({
        where: { role: 'STUDENT', enrollments: { some: { courseId: { in: assignedCourseIds } } } },
        select: { id: true }
      });
      await prisma.mentorship.deleteMany({ where: { mentorId: id as string } });
      if (overlappingStudents.length > 0) {
        updateData.menteesRelation = { create: overlappingStudents.map(s => ({ menteeId: s.id })) };
      }
    }

    const user = await prisma.user.update({
      where: { id: id as string },
      data: updateData,
      include: {
        enrollments: { select: { course: { select: { id: true, title: true } } } },
        mentorCourses: { select: { course: { select: { id: true, title: true } } } },
      },
    });

    res.status(200).json({
      message: 'User updated successfully',
      user: formatUserResponse(user),
    });
  } catch (error: any) {
    console.error('UpdateUser error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// DELETE /api/users/:id
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { id: id as string } });
    if (!existingUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    await prisma.user.delete({ where: { id: id as string } });

    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error: any) {
    console.error('DeleteUser error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
