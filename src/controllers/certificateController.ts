import { Request, Response } from 'express';
import { prisma } from '../utils/db';

// GET /api/certificates
export const getCertificates = async (req: Request, res: Response) => {
  try {
    const userRole = req.user?.role;
    const userId = req.user?.id;

    const paginate = req.query.paginate as string;
    const isPaginated = paginate !== 'false';

    // Pagination parameters
    const page = parseInt(req.query.page as string) || 1;
    const requestedLimit = parseInt(req.query.per_page as string) || 20;
    const per_page = Math.min(requestedLimit, 100); // Hard cap at 100
    const search = req.query.search as string || "";

    const skip = (page - 1) * per_page;

    let whereClause: any = {};

    if (userRole !== 'ADMIN') {
      whereClause.studentId = userId;
    }

    if (search) {
      whereClause.OR = [
        { certificateId: { contains: search } },
        { student: { name: { contains: search } } },
        { course: { title: { contains: search } } }
      ];
    }

    const [certificates, total] = await Promise.all([
      prisma.certificate.findMany({
        where: whereClause,
        include: {
          student: { select: { id: true, name: true, email: true } },
          course: { select: { id: true, title: true } }
        },
        orderBy: { createdAt: 'desc' },
        ...(isPaginated ? { skip, take: per_page } : {})
      }),
      prisma.certificate.count({ where: whereClause })
    ]);

    const totalPages = isPaginated ? Math.ceil(total / per_page) : 1;

    res.status(200).json({
      data: certificates,
      total,
      page: isPaginated ? page : 1,
      totalPages,
      per_page: isPaginated ? per_page : total
    });
  } catch (error: any) {
    console.error('getCertificates error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// GET /api/certificates/verify/:certificateId
export const verifyCertificate = async (req: Request, res: Response) => {
  try {
    const { certificateId } = req.params;

    const certificate = await prisma.certificate.findUnique({
      where: { certificateId: certificateId as string },
      include: {
        student: { select: { name: true } },
        course: { select: { title: true } }
      }
    });

    if (!certificate) {
      return res.status(404).json({ message: 'Certificate not found' });
    }

    let durationStr = "Self-Paced Track";
    if (certificate.startDate && certificate.endDate) {
      const start = new Date(certificate.startDate);
      const end = new Date(certificate.endDate);
      const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
      durationStr = `${months} Month${months !== 1 ? 's' : ''}`;
    }

    res.status(200).json({ ...certificate, duration: durationStr });
  } catch (error: any) {
    console.error('verifyCertificate error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// POST /api/certificates/issue
export const issueCertificate = async (req: Request, res: Response) => {
  try {
    const { studentId, courseId, dateOfIssue, startDate, endDate } = req.body;

    if (!studentId || !courseId || !dateOfIssue) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Generate unique Certificate ID
    const year = new Date(dateOfIssue).getFullYear();
    const student = await prisma.user.findUnique({ where: { id: studentId } });
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    let initials = 'XX';
    if (student.name) {
      const parts = student.name.trim().split(' ');
      if (parts.length === 1) {
        initials = parts[0][0].toUpperCase();
      } else {
        initials = parts[0][0].toUpperCase() + parts[parts.length - 1][0].toUpperCase();
      }
    }

    const startOfYear = new Date(`${year}-01-01`);
    const endOfYear = new Date(`${year}-12-31`);

    const existingCountThisYear = await prisma.certificate.count({
      where: {
        issueDate: {
          gte: startOfYear,
          lte: endOfYear
        }
      }
    });

    const sequence = String(existingCountThisYear + 1).padStart(3, '0');
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const certificateId = `CL-${year}-${initials}${sequence}-${randomSuffix}`;

    const newCertificate = await prisma.certificate.create({
      data: {
        certificateId,
        studentId,
        courseId,
        issueDate: new Date(dateOfIssue),
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined
      },
      include: {
        student: { select: { name: true, email: true } },
        course: { select: { title: true } }
      }
    });

    // Create an in-app notification for the student
    await prisma.appNotification.create({
      data: {
        title: 'New Certificate Issued! 🎉',
        message: `Congratulations! You have been issued a new certificate for completing "${newCertificate.course.title}". You can view and download it from your Certificates tab.`,
        type: 'success',
        userId: studentId,
      }
    });

    res.status(201).json(newCertificate);
  } catch (error: any) {
    console.error('issueCertificate error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// DELETE /api/certificates/:id
export const revokeCertificate = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existingCert = await prisma.certificate.findUnique({ where: { id: id as string } });
    if (!existingCert) {
      return res.status(404).json({ message: 'Certificate not found' });
    }

    await prisma.certificate.delete({ where: { id: id as string } });

    res.status(200).json({ message: 'Certificate revoked successfully' });
  } catch (error: any) {
    console.error('revokeCertificate error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
