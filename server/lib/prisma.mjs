import 'dotenv/config';
import pkg from "@prisma/client";
const { PrismaClient } = pkg;

// Singleton pattern for Prisma Client in serverless environment
const globalForPrisma = globalThis;



// Prisma configuration
const prismaOptions = {
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
