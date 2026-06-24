import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Use process.cwd() so the uploads folder is created at the root of api-backend
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const originalName = path.parse(file.originalname).name.replace(/[^a-zA-Z0-9]/g, '_');
    cb(null, originalName + '_' + uniqueSuffix + path.extname(file.originalname));
  }
});

export const uploadMiddleware = multer({
  storage: storage,
  limits: { fileSize: 1000 * 1024 * 1024 }, // 1GB limit for videos
  fileFilter: (req, file, cb) => {
    // Accept images, videos, pdfs/text, and zip/archives
    if (!file.originalname.match(/\.(jpg|jpeg|png|webp|mp4|m4v|webm|pdf|md|txt|zip|rar|7z)$/i)) {
      return cb(new Error('Invalid file type!'));
    }
    cb(null, true);
  }
});
