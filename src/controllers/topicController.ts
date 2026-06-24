import { Request, Response } from 'express';
import { prisma } from '../utils/db';
import { uploadToCloudinary } from '../utils/cloudinary';

// GET /api/topics/:id
export const getTopicById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const topic = await prisma.topic.findUnique({
      where: { id: id as string },
      include: {
        video: true,
        mcqs: {
          include: {
            options: true
          }
        },
        interviewQs: true,
        module: {
          select: {
            id: true,
            title: true,
            courseId: true
          }
        }
      }
    });

    if (!topic) {
      return res.status(404).json({ message: 'Topic not found' });
    }

    res.status(200).json(topic);
  } catch (error: any) {
    console.error('GetTopicById error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// POST /api/topics
export const createTopic = async (req: Request, res: Response) => {
  try {
    const { title, description, moduleId, mcqs, interviewQuestions } = req.body;

    if (!title || !moduleId) {
      return res.status(400).json({ message: 'Title and moduleId are required' });
    }

    let videoUrl = req.body.videoUrl || '';
    let pdfUrl = req.body.pdfUrl || '';
    let cheatsheetUrl = req.body.cheatsheetUrl || '';

    // If pre-uploaded URLs are not provided, upload files directly (fallback)
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    if (files) {
      if (!videoUrl && files['video'] && files['video'].length > 0) {
        videoUrl = await uploadToCloudinary(files['video'][0].path, 'topics/videos', 'video');
      }
      if (!pdfUrl && files['pdf'] && files['pdf'].length > 0) {
        pdfUrl = await uploadToCloudinary(files['pdf'][0].path, 'topics/pdfs', 'image');
      }
      if (!cheatsheetUrl && files['cheatsheet'] && files['cheatsheet'].length > 0) {
        cheatsheetUrl = await uploadToCloudinary(files['cheatsheet'][0].path, 'topics/pdfs', 'image');
      }
    }

    // Parse JSON
    let parsedMcqs = [];
    let parsedInterviewQs = [];
    try {
      if (mcqs) parsedMcqs = JSON.parse(mcqs);
      if (interviewQuestions) parsedInterviewQs = JSON.parse(interviewQuestions);
    } catch (e) {
      console.warn("Could not parse mcqs or interviewQuestions", e);
    }

    const result = await prisma.$transaction(async (tx) => {
      const topic = await tx.topic.create({
        data: {
          title,
          description: description || '',
          moduleId,
          pdfUrl: pdfUrl || null,
          cheatsheetUrl: cheatsheetUrl || null
        }
      });

      if (videoUrl) {
        await tx.video.create({
          data: {
            title: title + " Video",
            duration: "0:00",
            videoUrl: videoUrl,
            topicId: topic.id
          }
        });
      }

      if (parsedInterviewQs && parsedInterviewQs.length > 0) {
        for (const iq of parsedInterviewQs) {
          if (iq.question) {
            await tx.interviewQuestion.create({
              data: {
                question: iq.question,
                hints: iq.hints || [],
                topicId: topic.id
              }
            });
          }
        }
      }

      if (parsedMcqs && parsedMcqs.length > 0) {
        for (const mcq of parsedMcqs) {
          if (mcq.question) {
            const createdMcq = await tx.mCQQuestion.create({
              data: {
                question: mcq.question,
                explanation: mcq.explanation || '',
                topicId: topic.id
              }
            });

            if (mcq.options && Array.isArray(mcq.options)) {
              for (const opt of mcq.options) {
                const option = await tx.mCQOption.create({
                  data: {
                    text: opt.text,
                    questionId: createdMcq.id
                  }
                });
                if (opt.id === mcq.correctOptionId) {
                  await tx.mCQQuestion.update({
                    where: { id: createdMcq.id },
                    data: { correctOptionId: option.id }
                  });
                }
              }
            }
          }
        }
      }

      return topic;
    });

    res.status(201).json({ message: 'Topic created successfully', topic: result });
  } catch (error: any) {
    console.error('CreateTopic error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// PUT /api/topics/:id
export const updateTopic = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description } = req.body;
    let pdfUrl = req.body.pdfUrl;
    let cheatsheetUrl = req.body.cheatsheetUrl;
    
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    if (files) {
      if (files['pdf'] && files['pdf'].length > 0) {
        pdfUrl = await uploadToCloudinary(files['pdf'][0].path, 'topics/pdfs', 'image');
      }
      if (files['cheatsheet'] && files['cheatsheet'].length > 0) {
        cheatsheetUrl = await uploadToCloudinary(files['cheatsheet'][0].path, 'topics/pdfs', 'image');
      }
    }

    const existingTopic = await prisma.topic.findUnique({ where: { id: id as string } });
    if (!existingTopic) {
      return res.status(404).json({ message: 'Topic not found' });
    }

    const updatedTopic = await prisma.topic.update({
      where: { id: id as string },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(pdfUrl !== undefined && { pdfUrl }),
        ...(cheatsheetUrl !== undefined && { cheatsheetUrl })
      }
    });

    res.status(200).json({ message: 'Topic updated successfully', topic: updatedTopic });
  } catch (error: any) {
    console.error('UpdateTopic error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// DELETE /api/topics/:id
export const deleteTopic = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existingTopic = await prisma.topic.findUnique({ where: { id: id as string } });
    if (!existingTopic) {
      return res.status(404).json({ message: 'Topic not found' });
    }

    await prisma.topic.delete({ where: { id: id as string } });

    res.status(200).json({ message: 'Topic deleted successfully' });
  } catch (error: any) {
    console.error('DeleteTopic error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
