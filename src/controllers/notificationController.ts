import { Request, Response } from 'express';
import { prisma } from '../utils/db';

export const getNotifications = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    const excludeDismissed = req.query.excludeDismissed === 'true';

    const baseWhere: any = {
      OR: [
        { userId },
        { userId: null, targetRole: role },
        { userId: 'all', targetRole: role }
      ]
    };

    if (excludeDismissed) {
      baseWhere.isDismissed = false;
    }

    const notifications = await prisma.appNotification.findMany({
      where: baseWhere,
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const markAsRead = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const id = req.params.id as string;

    // Verify ownership or global status
    const notification = await prisma.appNotification.findUnique({
      where: { id }
    });

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    if (notification.userId && notification.userId !== userId) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const updated = await prisma.appNotification.update({
      where: { id },
      data: { isRead: true }
    });

    res.status(200).json(updated);
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const markAllAsRead = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    await prisma.appNotification.updateMany({
      where: {
        OR: [
          { userId },
          { userId: null, targetRole: role },
          { userId: 'all', targetRole: role }
        ],
        isRead: false
      },
      data: { isRead: true }
    });

    res.status(200).json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const deleteNotification = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const id = req.params.id as string;

    const notification = await prisma.appNotification.findUnique({
      where: { id }
    });

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    if (notification.userId && notification.userId !== userId) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    await prisma.appNotification.delete({
      where: { id }
    });

    res.status(200).json({ message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const clearAllNotifications = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    await prisma.appNotification.updateMany({
      where: {
        OR: [
          { userId },
          { userId: null, targetRole: role },
          { userId: 'all', targetRole: role }
        ],
        isDismissed: false
      },
      data: { isDismissed: true }
    });

    res.status(200).json({ message: 'All notifications cleared successfully' });
  } catch (error) {
    console.error('Error clearing all notifications:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
