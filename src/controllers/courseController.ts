import { Request, Response } from 'express';
import { prisma } from '../utils/db';
import { uploadToCloudinary } from '../utils/cloudinary';

// GET /api/courses
export const getCourses = async (req: Request, res: Response) => {
  try {
    const courses = await prisma.course.findMany({
      include: {
        _count: {
          select: { modules: true, enrollments: true }
        },
        modules: {
          include: {
            _count: { select: { topics: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Format response to match expected frontend structure
    const formattedCourses = courses.map(course => {
      const totalTopics = course.modules.reduce((acc, mod) => acc + mod._count.topics, 0);
      return {
        id: course.id,
        title: course.title,
        description: course.description,
        thumbnail: course.thumbnail,
        createdAt: course.createdAt,
        updatedAt: course.updatedAt,
        totalTopics: totalTopics,
        _count: { ...course._count, students: (course._count as any).enrollments }
      };
    });

    res.status(200).json(formattedCourses);
  } catch (error: any) {
    console.error('GetCourses error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// GET /api/courses/:id
export const getCourseById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const course = await prisma.course.findUnique({
      where: { id: id as string },
      include: {
        modules: {
          orderBy: { order: 'asc' },
          include: {
            topics: {
              orderBy: { createdAt: 'asc' },
              include: {
                video: true,
                mcqs: { include: { options: true } },
                interviewQs: true
              }
            }
          }
        }
      }
    });

    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    res.status(200).json(course);
  } catch (error: any) {
    console.error('GetCourseById error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// POST /api/courses
export const createCourse = async (req: Request, res: Response) => {
  try {
    const { title, description } = req.body;
    let { thumbnail } = req.body;

    if (req.file) {
      thumbnail = await uploadToCloudinary(req.file.path, 'courses/thumbnails', 'image');
    }

    if (!title || !description) {
      return res.status(400).json({ message: 'Title and description are required' });
    }

    const course = await prisma.course.create({
      data: {
        title,
        description,
        thumbnail: thumbnail || '/placeholder-course.jpg' // Default thumbnail if none provided
      }
    });

    res.status(201).json({ message: 'Course created successfully', course });
  } catch (error: any) {
    console.error('CreateCourse error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// PUT /api/courses/:id
export const updateCourse = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description } = req.body;
    let { thumbnail } = req.body;

    if (req.file) {
      thumbnail = await uploadToCloudinary(req.file.path, 'courses/thumbnails', 'image');
    }

    const existingCourse = await prisma.course.findUnique({ where: { id: id as string } });
    if (!existingCourse) {
      return res.status(404).json({ message: 'Course not found' });
    }

    const course = await prisma.course.update({
      where: { id: id as string },
      data: {
        ...(title && { title }),
        ...(description && { description }),
        ...(thumbnail && { thumbnail }),
      }
    });

    res.status(200).json({ message: 'Course updated successfully', course });
  } catch (error: any) {
    console.error('UpdateCourse error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// DELETE /api/courses/:id
export const deleteCourse = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existingCourse = await prisma.course.findUnique({ where: { id: id as string } });
    if (!existingCourse) {
      return res.status(404).json({ message: 'Course not found' });
    }

    await prisma.course.delete({ where: { id: id as string } });

    res.status(200).json({ message: 'Course deleted successfully' });
  } catch (error: any) {
    console.error('DeleteCourse error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
