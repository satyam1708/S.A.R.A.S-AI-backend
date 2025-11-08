// src/app.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './modules/auth/auth.routes.js';
import bookmarkRoutes from './modules/bookmarks/bookmarks.routes.js';
import newsRoutes from './modules/news/news.routes.js';
import gsRoutes from './modules/gs/gs.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
// We will import gsRoutes here later

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// --- Middleware Setup ---
app.use(express.json());

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
// app.use('/api/gs', gsRoutes); // We will add this in Phase 2

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});