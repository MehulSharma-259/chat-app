/** @format */
import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.utils';

// Auth middleware to protect routes
export const protect = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }
    
    // Verify token
    const decoded = verifyToken(token);
    
    // Add user from payload to request
    // @ts-ignore
    req.user = decoded;
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ message: 'Token is not valid' });
  }
};