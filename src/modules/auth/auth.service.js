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
    select: { id: true, name: true, email: true, role: true }, // <-- ADDED role
  });
  
  return newUser;
};

export const login = async (email, password) => {
  const user = await prisma.user.findUnique({ where: { email } });
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
      role: user.role // <-- FIX 1: Add role to the JWT token
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  return { 
    token, 
    user: { 
      id: user.id, 
      name: user.name, 
      email: user.email, 
      role: user.role // <-- FIX 2: Add role to the returned user object
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
      role: true // <-- FIX 3: Select the role from the database
    },
  });
  if (!user) {
    throw new AppError('User not found', 404);
  }
  return user;
};