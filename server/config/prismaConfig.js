import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const connectionString = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL

if (!connectionString) {
    throw new Error('DATABASE_URL or DIRECT_DATABASE_URL is required for Prisma Client')
}

const pool = new pg.Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

export { prisma }