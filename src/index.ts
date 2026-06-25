import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import courseRoutes from './routes/courses';
import moduleRoutes from './routes/modules';
import topicRoutes from './routes/topics';
import uploadRoutes from './routes/upload';
import meRoutes from './routes/meRoutes';
import assignmentRoutes from './routes/assignmentRoutes';
import qaRoutes from './routes/qaRoutes';
import notificationRoutes from './routes/notificationRoutes';
import certificateRoutes from './routes/certificateRoutes';
import statsRoutes from './routes/statsRoutes';
import settingsRoutes from './routes/settings';
import couponRoutes from './routes/couponRoutes';
import blogRoutes from './routes/blogRoutes';
import { apiLimiter } from './middlewares/rateLimiter';

const app = express();

// Middleware
const allowedOrigins = (process.env.ALLOWED_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim());
// Also allow port 3001 as Next.js falls back to it when 3000 is busy
if (allowedOrigins.includes('http://localhost:3000') && !allowedOrigins.includes('http://localhost:3001')) {
  allowedOrigins.push('http://localhost:3001');
}
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());

// Apply rate limiting
app.use('/api/', apiLimiter);

// Serve static files from the uploads directory
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/assignments', assignmentRoutes);
app.use('/api/v1/qa', qaRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/me', meRoutes);
app.use('/api/v1/courses', courseRoutes);
app.use('/api/v1/modules', moduleRoutes);
app.use('/api/v1/topics', topicRoutes);
app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/certificates', certificateRoutes);
app.use('/api/v1/stats', statsRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/coupons', couponRoutes);
app.use('/api/v1/blogs', blogRoutes);

// Basic health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
