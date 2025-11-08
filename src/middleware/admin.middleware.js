// src/middleware/admin.middleware.js
export const adminOnly = (req, res, next) => {
  // req.user comes from the authenticateToken middleware
  if (req.user && req.user.role === 'ADMIN') {
    next();
  } else {
    res.status(403).json({ message: 'Forbidden: Admin access required' });
  }
};