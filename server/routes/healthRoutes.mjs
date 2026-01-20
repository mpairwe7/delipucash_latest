import express from 'express';
import { checkDatabaseHealth } from '../config/db.mjs';

const router = express.Router();

// Comprehensive health check
router.get('/health', async (req, res) => {
  try {
    const dbHealth = await checkDatabaseHealth();
    
    const healthStatus = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      database: dbHealth,
      services: {
        api: 'healthy',
        database: dbHealth.status
      }
    };

    // Set status based on database health
    const statusCode = dbHealth.status === 'healthy' ? 200 : 503;
    
    res.status(statusCode).json(healthStatus);
  } catch (error) {
    res.status(503).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      error: error.message,
      services: {
        api: 'degraded',
        database: 'unhealthy'
      }
    });
  }
});

// Simple ping endpoint
router.get('/ping', (req, res) => {
  res.json({ 
    message: 'pong', 
    timestamp: new Date().toISOString() 
  });
});

export default router;
