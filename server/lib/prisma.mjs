import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

// Singleton pattern for Prisma Client in serverless environment
const globalForPrisma = globalThis;

/**
 * PrismaClient initialization with Prisma Accelerate
 * 
 * Accelerate provides:
 * - Global edge caching for faster queries
 * - Connection pooling for better database utilization
 * - Reduced database load through intelligent caching
 * 
 * Setup:
 * 1. Go to https://console.prisma.io and create a project
 * 2. Enable Accelerate and get your API key
 * 3. Set ACCELERATE_URL in .env: prisma://accelerate.prisma-data.net/?api_key=YOUR_KEY
 * 4. Keep DIRECT_DATABASE_URL for migrations: your direct MongoDB connection
 */
const isAccelerateEnabled = process.env.ACCELERATE_URL?.startsWith('prisma://');

const basePrisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
  // Use Accelerate URL if available, otherwise fall back to direct connection
  datasourceUrl: isAccelerateEnabled ? process.env.ACCELERATE_URL : process.env.DATABASE_URL,
});

// Extend with Accelerate for caching capabilities
const prisma = globalForPrisma.prisma || (
  isAccelerateEnabled 
    ? basePrisma.$extends(withAccelerate())
    : basePrisma
);

// Prevent multiple instances in development
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default prisma;
