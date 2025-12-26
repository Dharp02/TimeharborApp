import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models';
import logger from '../utils/logger';

// Extend Express Request type to include user
export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    full_name?: string;
  };
}

export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({ error: 'Access token required' });
      return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      logger.error('JWT_SECRET is not defined in environment variables');
      res.status(500).json({ error: 'Server configuration error' });
      return;
    }

    // Verify token
    const decoded = jwt.verify(token, jwtSecret) as { id: string; email: string };

    // Fetch user from database
    const user = await User.findByPk(decoded.id, {
      attributes: ['id', 'email', 'full_name', 'email_verified']
    });

    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      full_name: user.full_name
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Token expired' });
      return;
    }
    
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    logger.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// Optional middleware for routes that can work with or without authentication
export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      next();
      return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      next();
      return;
    }

    const decoded = jwt.verify(token, jwtSecret) as { id: string; email: string };
    const user = await User.findByPk(decoded.id, {
      attributes: ['id', 'email', 'full_name', 'email_verified']
    });

    if (user) {
      req.user = {
        id: user.id,
        email: user.email,
        full_name: user.full_name
      };
    }

    next();
  } catch (error) {
    // Continue without authentication if token is invalid
    next();
  }
};
