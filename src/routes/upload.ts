import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate } from '../middlewares/auth';
import { uploadToCloudinary } from '../utils/cloudinary';

const router = express.Router();

// Ensure temp uploads directory exists
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer storage (temp local storage before Cloudinary upload)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    // Sanitize the original file name (remove ext and replace spaces/special chars)
    const originalName = path.parse(file.originalname).name.replace(/[^a-zA-Z0-9]/g, '_');
    cb(null, originalName + '_' + uniqueSuffix + path.extname(file.originalname));
  }
});

const imageUpload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit for images
  fileFilter: (req, file, cb) => {
    if (!file.originalname.match(/\.(jpg|jpeg|png|webp)$/i)) {
      return cb(new Error('Only image files are allowed!'));
    }
    cb(null, true);
  }
});

const mediaUpload = multer({
  storage: storage,
  limits: { fileSize: 1000 * 1024 * 1024 }, // 1GB limit for videos
  fileFilter: (req, file, cb) => {
    if (!file.originalname.match(/\.(jpg|jpeg|png|webp|mp4|m4v|webm|pdf|md|txt|zip|rar|7z)$/i)) {
      return cb(new Error('Invalid file type!'));
    }
    cb(null, true);
  }
});

// POST /api/v1/upload - Image upload
router.post('/', authenticate, imageUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    const cloudinaryUrl = await uploadToCloudinary(req.file.path, 'uploads', 'image');
    res.status(200).json({ url: cloudinaryUrl });
  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/v1/upload/video - Pre-upload video to Cloudinary (before saving topic)
router.post('/video', authenticate, mediaUpload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No video file uploaded' });
    }
    console.log(`Uploading video to Cloudinary: ${req.file.originalname} (${(req.file.size / 1024 / 1024).toFixed(1)} MB)`);
    const cloudinaryUrl = await uploadToCloudinary(req.file.path, 'topics/videos', 'video');
    console.log(`Video uploaded successfully: ${cloudinaryUrl}`);
    res.status(200).json({ url: cloudinaryUrl });
  } catch (error: any) {
    console.error('Video upload error:', error);
    res.status(500).json({ message: error?.message || 'Video upload failed', details: error });
  }
});

// POST /api/v1/upload/pdf - Pre-upload PDF to Cloudinary
router.post('/pdf', authenticate, mediaUpload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No PDF file uploaded' });
    }
    const cloudinaryUrl = await uploadToCloudinary(req.file.path, 'topics/pdfs', 'image');
    res.status(200).json({ url: cloudinaryUrl });
  } catch (error: any) {
    console.error('PDF upload error:', error);
    res.status(500).json({ message: error?.message || 'PDF upload failed', details: error });
  }
});

// Upload assignment documents (zip, pdf, etc.) as raw to Cloudinary
router.post('/document', authenticate, mediaUpload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No document file uploaded' });
    }
    // Note: ZIP files MUST be uploaded as 'raw', unlike PDFs which we upload as 'image'
    const cloudinaryUrl = await uploadToCloudinary(req.file.path, 'assignments/documents', 'raw');
    res.status(200).json({ url: cloudinaryUrl });
  } catch (error: any) {
    console.error('Document upload error:', error);
    res.status(500).json({ message: error.message || 'Error uploading document' });
  }
});

export default router;
