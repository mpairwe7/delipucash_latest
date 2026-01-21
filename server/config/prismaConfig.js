import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const datasourceUrl = process.env.DATABASE_URL ?? process.env.DIRECT_DATABASE_URL
const accelerateUrl = process.env.ACCELERATE_URL ?? process.env.DATABASE_URL

if (!datasourceUrl) {
    throw new Error('DATABASE_URL or DIRECT_DATABASE_URL is required for Prisma Client')
}

const prisma = new PrismaClient()

export { prisma }