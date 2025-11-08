// src/middleware/admin.middleware.js
import prisma from '../lib/prisma.js';

export const adminOnly = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    
    if (user && user.role === 'ADMIN') {
      next();
    } else {
      res.status(403).json({ message: 'Forbidden: Admin access required' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error while verifying admin role' });
  }
};