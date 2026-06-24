import { Request, Response } from 'express';
import { prisma } from '../utils/db';

// POST /api/modules (with courseId in body) or /api/courses/:courseId/modules depending on route setup
// Let's assume POST /api/modules and pass courseId in body for simplicity
export const createModule = async (req: Request, res: Response) => {
  try {
    const { title, courseId, order } = req.body;

    if (!title || !courseId) {
      return res.status(400).json({ message: 'Title and courseId are required' });
    }

    const newModule = await prisma.courseModule.create({
      data: {
        title,
        order: order || 0,
        courseId
      }
    });

    res.status(201).json({ message: 'Module created successfully', module: newModule });
  } catch (error: any) {
    console.error('CreateModule error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// PUT /api/modules/:id
export const updateModule = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, order } = req.body;

    const existingModule = await prisma.courseModule.findUnique({ where: { id: id as string } });
    if (!existingModule) {
      return res.status(404).json({ message: 'Module not found' });
    }

    const updatedModule = await prisma.courseModule.update({
      where: { id: id as string },
      data: {
        ...(title && { title }),
        ...(order !== undefined && { order })
      }
    });

    res.status(200).json({ message: 'Module updated successfully', module: updatedModule });
  } catch (error: any) {
    console.error('UpdateModule error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// DELETE /api/modules/:id
export const deleteModule = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existingModule = await prisma.courseModule.findUnique({ where: { id: id as string } });
    if (!existingModule) {
      return res.status(404).json({ message: 'Module not found' });
    }

    await prisma.courseModule.delete({ where: { id: id as string } });

    res.status(200).json({ message: 'Module deleted successfully' });
  } catch (error: any) {
    console.error('DeleteModule error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
