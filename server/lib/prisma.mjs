import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

// Singleton pattern for Prisma Client in serverless environment
const globalForPrisma = globalThis;

// Get the accelerate URL for Prisma 7.x client engine
const accelerateUrl = process.env.ACCELERATE_URL;

// Prisma configuration for client engine type (Prisma 7.x default)
const prismaOptions = {
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
  accelerateUrl: accelerateUrl,
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
