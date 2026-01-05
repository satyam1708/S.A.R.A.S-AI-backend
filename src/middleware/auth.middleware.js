import jwt from 'jsonwebtoken';

// Rename 'authenticateToken' to 'authMiddleware'
export const authMiddleware = (req, res, next) => {
  if (!process.env.JWT_SECRET) {
  throw new Error("FATAL: JWT_SECRET is not defined.");
}
const JWT_SECRET = process.env.JWT_SECRET;
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = user;
    next();
  });
};