import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';

// Singleton pattern for Prisma Client in serverless environment
const globalForPrisma = globalThis;


const datasourceUrl = process.env.DATABASE_URL ?? process.env.DIRECT_DATABASE_URL;
const accelerateUrl = process.env.ACCELERATE_URL ?? process.env.DATABASE_URL;

if (!datasourceUrl) {
  throw new Error('DATABASE_URL or DIRECT_DATABASE_URL is required for Prisma Client');
}



// Prisma configuration
const prismaOptions = {
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
};

// Create the prisma instance with Accelerate
const prisma = globalForPrisma.prisma
  || new PrismaClient(prismaOptions).$extends(withAccelerate({ accelerateUrl }));

// Prevent multiple instances in development
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default prisma;
