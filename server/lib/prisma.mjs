import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

// Singleton pattern for Prisma Client in serverless environment
const globalForPrisma = globalThis;

const accelerateUrl = process.env.ACCELERATE_URL;

if (!accelerateUrl) {
  throw new Error('ACCELERATE_URL is required for Prisma Client');
}

// Prisma configuration
const prismaOptions = {
  accelerateUrl: accelerateUrl,
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
};

// Create the prisma instance
const prisma = globalForPrisma.prisma || new PrismaClient(prismaOptions);

// Prevent multiple instances in development
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default prisma;
