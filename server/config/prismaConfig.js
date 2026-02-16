import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

// Runtime uses pooled connection (port 6543, PgBouncer transaction mode).
// DIRECT_DATABASE_URL (port 5432) is only for Prisma Migrate in prisma.config.ts.
const connectionString = process.env.DATABASE_URL || process.env.DIRECT_DATABASE_URL

if (!connectionString) {
    throw new Error('DATABASE_URL or DIRECT_DATABASE_URL is required for Prisma Client')
}

const pool = new pg.Pool({
  connectionString,
  max: 2,
  idleTimeoutMillis: 20_000,
  connectionTimeoutMillis: 10_000,
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

export { prisma }