import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

// Singleton pattern for Prisma Client in serverless environment
const globalForPrisma = globalThis;

// Runtime uses pooled connection (port 6543, PgBouncer transaction mode).
// DIRECT_DATABASE_URL (port 5432) is only for Prisma Migrate in prisma.config.ts.
const connectionString = process.env.DATABASE_URL || process.env.DIRECT_DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL or DIRECT_DATABASE_URL is required for Prisma Client');
}

const pool = new pg.Pool({
  connectionString,
  max: 2,                // Low pool size — PgBouncer handles concurrency
  idleTimeoutMillis: 20_000,  // Release idle connections after 20s
  connectionTimeoutMillis: 10_000, // Fail fast on connection timeout
});
const adapter = new PrismaPg(pool);

// Prisma configuration
const prismaOptions = {
  adapter: adapter,
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
