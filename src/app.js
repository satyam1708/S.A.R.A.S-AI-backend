// src/app.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';

// Route imports
import authRoutes from './modules/auth/auth.routes.js';
import bookmarkRoutes from './modules/bookmarks/bookmarks.routes.js';
import newsRoutes from './modules/news/news.routes.js';
import gsRoutes from './modules/gs/gs.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
import courseRoutes from './modules/courses/courses.routes.js';
import examRoutes from './modules/exams/exams.routes.js';
import englishRoutes from './modules/english/english.routes.js';
import questionBankRoutes from './modules/question-bank/question-bank.routes.js';

// Load environment variables
dotenv. config();

// Debug: Environment check (development only)
if (process.env.NODE_ENV === 'development') {
  console.log('🔐 Environment Check: ');
  console.log('JWT_SECRET:', process.env.JWT_SECRET ?  '✅ Loaded' :  '❌ Missing');
  console.log('DATABASE_URL:', process.env.DATABASE_URL ?  '✅ Loaded' :  '❌ Missing');
  console.log('PORT:', process. env.PORT || 'Using default 5000');
  console.log('NODE_ENV:', process.env.NODE_ENV);
}

const app = express();
const PORT = process.env.PORT || 5000;

// --- Middleware Setup ---
app.use(express. json({ limit: '10mb' })); // Body parser with size limit
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// CORS Configuration
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [
      'https://saras-ai. vercel.app',
      'https://www.saras-ai.com', // Add your production domains
      process.env.FRONTEND_URL
    ].filter(Boolean)
  : [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://127.0.0.1:5173'
    ];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`🚫 CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));

// Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// Request Logger (development only)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`, {
      body: req.body,
      query: req.query,
      params: req.params
    });
    next();
  });
}

// --- Health Check & Info ---
app.get('/', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    message: 'SARAS AI Backend is running 🚀',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
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

// --- 404 Handler ---
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Route ${req.method} ${req.path} not found`,
    availableRoutes: [
      '/api/auth',
      '/api/bookmarks',
      '/api/news',
      '/api/gs',
      '/api/admin',
      '/api/courses',
      '/api/exams',
      '/api/english',
      '/api/question-bank'
    ]
  });
});

// --- Enterprise Global Error Handler ---
app.use((err, req, res, next) => {
  // 1.  Structured logging (ready for Datadog/ELK/CloudWatch)
  const errorLog = {
    level: 'error',
    message: err. message,
    stack: process. env.NODE_ENV === 'production' ? undefined : err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    timestamp: new Date().toISOString(),
    userId: req.user?.id // If auth middleware attaches user
  };

  console.error(JSON.stringify(errorLog, null, 2));

  // 2. Determine Status Code
  const statusCode = err.statusCode || err.status || 500;

  // 3. Send Safe Response (hide sensitive details in production)
  res.status(statusCode).json({
    status: 'error',
    message:  statusCode === 500 && process.env.NODE_ENV === 'production'
      ? 'Internal Server Error' 
      : err.message(process.env.NODE_ENV === 'development' && { 
      stack: err.stack,
      details: err.details 
    })
  });
});

// --- Graceful Shutdown ---
const server = app.listen(PORT, () => {
  console.log('\n🚀 ================================');
  console.log(`✅ SARAS AI Backend Server Started`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Port: ${PORT}`);
  console.log(`🔗 URL: http://localhost:${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/api/health`);
  console.log('================================\n');
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM signal received:  closing HTTP server');
  server.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n👋 SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

export default app;