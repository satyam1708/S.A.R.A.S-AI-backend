import prisma from "../../lib/prisma.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";

// --- SECURITY FIX ---
// Check for secret immediately. If missing, crash the app on startup.
if (!process.env.JWT_SECRET) {
  throw new Error("FATAL: JWT_SECRET is not defined in .env file");
}
const JWT_SECRET = process.env.JWT_SECRET;

// Helper for standardized errors
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

export const register = async (name, email, password) => {
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    throw new AppError("Email already registered", 400);
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = await prisma.user.create({
    data: { name, email, password: hashedPassword },
    select: { id: true, name: true, email: true, role: true },
  });

  return newUser;
};

// ... imports
import { v4 as uuidv4 } from "uuid"; // You might need 'npm install uuid'

// FIX: Generate Token Pair (Access + Refresh)
export const login = async (email, password) => {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { selectedCourse: true },
  });

  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new AppError("Invalid email or password", 401);
  }

  // 1. Generate Short-lived Access Token (15 mins)
  const accessToken = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }
  );

  // 2. Generate Long-lived Refresh Token (7 days)
  const refreshToken = uuidv4();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  // 3. Store Refresh Token in DB (Rotation Strategy)
  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt,
    },
  });

  return { accessToken, refreshToken, user };
};

// ADD: Refresh Token Logic
export const refreshAccessToken = async (incomingRefreshToken) => {
  const storedToken = await prisma.refreshToken.findUnique({
    where: { token: incomingRefreshToken },
    include: { user: true },
  });

  if (
    !storedToken ||
    storedToken.revoked ||
    new Date() > storedToken.expiresAt
  ) {
    // Security: If we detect reuse of a revoked token, we could nuke all tokens for this user
    throw new AppError("Invalid or expired refresh token", 403);
  }

  // Rotate Token: Revoke old one, issue new one (Optional but recommended)
  // For simplicity here, we just issue a new access token
  const newAccessToken = jwt.sign(
    { id: storedToken.user.id, role: storedToken.user.role },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }
  );

  return { accessToken: newAccessToken };
};

export const getProfileById = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      selectedCourse: true,
    },
  });

  if (!user) throw new AppError("User not found", 404);
  return user;
};

export const updateUserCourse = async (userId, courseId) => {
  return await prisma.user.update({
    where: { id: userId },
    data: { selectedCourseId: parseInt(courseId, 10) },
    include: { selectedCourse: true },
  });
};
