import prisma from '../lib/prisma.mjs';

const connectDB = async () => {
  try {
    // Test the connection
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connected successfully');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    
    // In serverless, we don't want to exit the process
    if (process.env.VERCEL !== '1') {
      process.exit(1);
    }
    
    throw error;
  }
};

// Health check function for database
export const checkDatabaseHealth = async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'healthy', timestamp: new Date().toISOString() };
  } catch (error) {
    return { 
      status: 'unhealthy', 
      error: error.message,
      timestamp: new Date().toISOString() 
    };
  }
};

export default connectDB;
