import { Request, Response } from 'express';
import { prisma } from '../utils/db';

// Get global settings (creates default if it doesn't exist)
export const getSettings = async (req: Request, res: Response) => {
  try {
    let settings = await prisma.settings.findUnique({
      where: { id: 'global' },
    });

    if (!settings) {
      settings = await prisma.settings.create({
        data: {
          id: 'global',
        },
      });
    }

    res.status(200).json(settings);
  } catch (error: any) {
    console.error('Get Settings Error:', error);
    res.status(500).json({ message: 'Failed to fetch settings', error: error.message });
  }
};

// Update global settings
export const updateSettings = async (req: Request, res: Response) => {
  try {
    const { platformName, supportEmail, maintenanceMode } = req.body;

    const settings = await prisma.settings.upsert({
      where: { id: 'global' },
      update: {
        platformName,
        supportEmail,
        maintenanceMode,
      },
      create: {
        id: 'global',
        platformName,
        supportEmail,
        maintenanceMode,
      },
    });

    res.status(200).json({ message: 'Settings updated successfully', settings });
  } catch (error: any) {
    console.error('Update Settings Error:', error);
    res.status(500).json({ message: 'Failed to update settings', error: error.message });
  }
};
