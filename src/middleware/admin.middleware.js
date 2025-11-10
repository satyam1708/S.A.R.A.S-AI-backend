// Rename 'adminOnly' to 'adminMiddleware'
export const adminMiddleware = (req, res, next) => {
  // req.user comes from the authMiddleware
  if (req.user && req.user.role === 'ADMIN') {
    next();
  } else {
    res.status(403).json({ message: 'Forbidden: Admin access required' });
  }
};