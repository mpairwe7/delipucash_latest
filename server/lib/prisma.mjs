import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';

// Singleton pattern for Prisma Client in serverless environment
const globalForPrisma = globalThis;

// Use direct database URL for queries
const datasourceUrl = process.env.DATABASE_URL ?? process.env.DIRECT_DATABASE_URL;

if (!datasourceUrl) {
  throw new Error('DATABASE_URL or DIRECT_DATABASE_URL is required for Prisma Client');
}

// Prisma configuration with datasource override
const prismaOptions = {
  datasources: {
    db: {
      url: datasourceUrl,
    },
  },
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
};

// Create the prisma instance with Accelerate extension (but using direct database URL)
const prisma = globalForPrisma.prisma || new PrismaClient(prismaOptions).$extends(withAccelerate());

// Prevent multiple instances in development
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default prisma;
