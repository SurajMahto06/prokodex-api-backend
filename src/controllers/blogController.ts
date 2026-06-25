import { Request, Response } from 'express';
import { prisma } from '../utils/db';

// Get all blogs (Public)
export const getBlogs = async (req: Request, res: Response) => {
  try {
    const { publishedOnly = 'true' } = req.query;
    const whereClause = publishedOnly === 'true' ? { isPublished: true } : {};

    const blogs = await prisma.blog.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        slug: true,
        coverImage: true,
        author: true,
        isPublished: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.status(200).json(blogs);
  } catch (error) {
    console.error('Error fetching blogs:', error);
    return res.status(500).json({ message: 'Failed to fetch blogs' });
  }
};

// Get single blog by slug (Public)
export const getBlogBySlug = async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug as string;
    const blog = await prisma.blog.findUnique({
      where: { slug },
    });

    if (!blog) {
      return res.status(404).json({ message: 'Blog not found' });
    }

    return res.status(200).json(blog);
  } catch (error) {
    console.error('Error fetching blog:', error);
    return res.status(500).json({ message: 'Failed to fetch blog' });
  }
};

// Create a new blog (Admin)
export const createBlog = async (req: Request, res: Response) => {
  try {
    const { title, slug, content, coverImage, author, isPublished } = req.body;

    if (!title || !slug || !content) {
      return res.status(400).json({ message: 'Title, slug, and content are required' });
    }

    const existingBlog = await prisma.blog.findUnique({ where: { slug } });
    if (existingBlog) {
      return res.status(400).json({ message: 'A blog with this slug already exists' });
    }

    const newBlog = await prisma.blog.create({
      data: {
        title,
        slug,
        content,
        coverImage,
        author: author || 'Prokodex Team',
        isPublished: isPublished !== undefined ? isPublished : true,
      },
    });

    return res.status(201).json(newBlog);
  } catch (error) {
    console.error('Error creating blog:', error);
    return res.status(500).json({ message: 'Failed to create blog' });
  }
};

// Update a blog (Admin)
export const updateBlog = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { title, slug, content, coverImage, author, isPublished } = req.body;

    const existingBlog = await prisma.blog.findUnique({ where: { id } });
    if (!existingBlog) {
      return res.status(404).json({ message: 'Blog not found' });
    }

    if (slug && slug !== existingBlog.slug) {
      const duplicateSlug = await prisma.blog.findUnique({ where: { slug } });
      if (duplicateSlug) {
        return res.status(400).json({ message: 'A blog with this new slug already exists' });
      }
    }

    const updatedBlog = await prisma.blog.update({
      where: { id },
      data: {
        title,
        slug,
        content,
        coverImage,
        author,
        isPublished,
      },
    });

    return res.status(200).json(updatedBlog);
  } catch (error) {
    console.error('Error updating blog:', error);
    return res.status(500).json({ message: 'Failed to update blog' });
  }
};

// Delete a blog (Admin)
export const deleteBlog = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const existingBlog = await prisma.blog.findUnique({ where: { id } });
    if (!existingBlog) {
      return res.status(404).json({ message: 'Blog not found' });
    }

    await prisma.blog.delete({
      where: { id },
    });

    return res.status(200).json({ message: 'Blog deleted successfully' });
  } catch (error) {
    console.error('Error deleting blog:', error);
    return res.status(500).json({ message: 'Failed to delete blog' });
  }
};
