/** @format */
import jwt from 'jsonwebtoken';

// JWT secret key - in production, use environment variables
const JWT_SECRET = 'your_jwt_secret';

// Generate JWT token
export const generateToken = (userId: string): string => {
  return jwt.sign({ id: userId }, JWT_SECRET, {
    expiresIn: '30d'
  });
};

// Verify JWT token
export const verifyToken = (token: string): any => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid token');
  }
};