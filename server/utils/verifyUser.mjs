// middleware.js
import jwt from 'jsonwebtoken';
import { errorHandler } from './error.mjs';
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
      console.log('Token verification failed:', err);
      return next(errorHandler(403, 'Forbidden'));
    }

    req.user = decoded;
    req.userRef = decoded.id;
    console.log('Token verified successfully:', decoded);
    next();
  });
};
