/** @format */
import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.utils';

// **Ensure 'export' is present**
export interface AuthenticatedRequest extends Request {
    user?: { id: string };
}

export const protect = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  // ... (rest of the function is likely correct from previous step)
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'No token, authorization denied' });
    const decoded = verifyToken(token) as { id: string };
    req.user = { id: decoded.id };
    next();
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown authentication error';
    console.error('Auth middleware error:', errorMessage);
    res.status(401).json({ message: 'Token is not valid' });
  }
};