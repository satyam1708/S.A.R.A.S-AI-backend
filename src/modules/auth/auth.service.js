// src/modules/auth/auth.service.js
import prisma from '../../lib/prisma.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'defaultsecret';

// A helper for custom errors
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

export const register = async (name, email, password) => {
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    throw new AppError('Email already registered', 400);
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  
  const newUser = await prisma.user.create({
    data: { name, email, password: hashedPassword },
    select: { id: true, name: true, email: true, role: true }, 
  });
  
  return newUser;
};

export const login = async (email, password) => {
  // UPDATED: Include selectedCourse in the query
  const user = await prisma.user.findUnique({ 
    where: { email },
    include: { selectedCourse: true } 
  });

  if (!user) {
    throw new AppError('Invalid email or password', 400);
  }

  const validPass = await bcrypt.compare(password, user.password);
  if (!validPass) {
    throw new AppError('Invalid email or password', 400);
  }

  const token = jwt.sign(
    { 
      id: user.id, 
      name: user.name, 
      email: user.email, 
      role: user.role 
    },
    JWT_SECRET,
    { expiresIn: '7d' } // Increased to 7 days for better UX
  );

  return { 
    token, 
    user: { 
      id: user.id, 
      name: user.name, 
      email: user.email, 
      role: user.role,
      // UPDATED: Pass the course data back to the frontend
      selectedCourse: user.selectedCourse
    } 
  };
};

export const getProfileById = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { 
      id: true, 
      name: true, 
      email: true, 
      role: true,
      // UPDATED: Select the course details so the frontend knows a choice was made
      selectedCourse: true 
    },
  });
  if (!user) {
    throw new AppError('User not found', 404);
  }
  return user;
};

export const updateUserCourse = async (userId, courseId) => {
  return await prisma.user.update({
    where: { id: userId },
    data: { selectedCourseId: parseInt(courseId) },
    include: { selectedCourse: true } // Return the course details confirmation
  });
};