// src/app.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './modules/auth/auth.routes.js';
import bookmarkRoutes from './modules/bookmarks/bookmarks.routes.js';
import newsRoutes from './modules/news/news.routes.js';
import gsRoutes from './modules/gs/gs.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
import courseRoutes from './modules/courses/courses.routes.js';
import examRoutes from './modules/exams/exams.routes.js';
import englishRoutes from './modules/english/english.routes.js';
import questionBankRoutes from './modules/question-bank/question-bank.routes.js';
import cookieParser from 'cookie-parser';
// We will import gsRoutes here later

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// --- Middleware Setup ---
app.use(express.json());
app.use(cookieParser());

const allowedOrigins = [
  'http://localhost:5173',
  'https://thesarvanews.vercel.app'
];

const corsOptions = {
  origin: allowedOrigins,
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// --- Health Check ---
app.get('/', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'TheSarvaNews Backend is running 🚀' });
});

// --- Mount Feature Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/bookmarks', bookmarkRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/gs', gsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/english', englishRoutes);
app.use('/api/question-bank', questionBankRoutes);
// app.use('/api/gs', gsRoutes); // We will add this in Phase 2

// Enterprise Global Error Handler
app.use((err, req, res, next) => {
  // 1. Log the error structurally (for Datadog/ELK)
  console.error(JSON.stringify({
    level: 'error',
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack, // Hide stack in prod
    path: req.path,
    method: req.method,
    ip: req.ip
  }));
  
  // 2. Determine Status Code
  const statusCode = err.statusCode || 500;

  // 3. Send Safe Response
  res.status(statusCode).json({
    status: 'error',
    message: statusCode === 500 && process.env.NODE_ENV === 'production' 
      ? 'Internal Server Error' 
      : err.message
  });
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});