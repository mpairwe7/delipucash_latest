// middleware.js
import jwt from 'jsonwebtoken';
import { errorHandler } from './error.mjs';
import prisma from '../lib/prisma.mjs';
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables from .env

export const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader) {
    console.log('Authorization header is missing.');
    return next(errorHandler(401, 'Unauthorized'));
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    console.log('No token provided.');
    return next(errorHandler(401, 'Unauthorized'));
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      // Expired tokens get 401 so the client can silently refresh
      if (err.name === 'TokenExpiredError') {
        return next(errorHandler(401, 'Token expired'));
      }
      // Invalid/tampered tokens get 403 — no refresh possible
      return next(errorHandler(403, 'Forbidden'));
    }

    req.user = decoded;
    req.userRef = decoded.id;
    next();
  });
};

/**
 * Role-based authorization middleware
 * Checks if user has the required role(s)
 * Handles null roles by treating them as 'USER' (default)
 * 
 * @param {...string} allowedRoles - Roles allowed to access the route
 */
export const requireRole = (...allowedRoles) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return next(errorHandler(401, 'Authentication required'));
      }

      // Fetch user with role from database
      const user = await prisma.appUser.findUnique({
        where: { id: req.user.id },
        select: { id: true, role: true }
      });

      if (!user) {
        return next(errorHandler(404, 'User not found'));
      }

      // Handle null/undefined role - treat as 'USER' (default role)
      const userRole = user.role || 'USER';

      if (!allowedRoles.includes(userRole)) {
        console.log(`Access denied: User role '${userRole}' not in allowed roles [${allowedRoles.join(', ')}]`);
        return next(errorHandler(403, 'Insufficient permissions'));
      }

      // Attach role to request for downstream use
      req.user.role = userRole;
      next();
    } catch (error) {
      console.error('Role verification error:', error);
      return next(errorHandler(500, 'Authorization check failed'));
    }
  };
};

/**
 * Admin-only middleware shorthand
 */
export const requireAdmin = requireRole('ADMIN');

/**
 * Admin or Moderator middleware shorthand
 */
export const requireModerator = requireRole('ADMIN', 'MODERATOR');
