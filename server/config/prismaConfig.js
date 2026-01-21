import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const datasourceUrl = process.env.DATABASE_URL
const accelerateUrl = process.env.ACCELERATE_URL

if (!datasourceUrl) {
    throw new Error('DATABASE_URL is required for Prisma Client')
}

const prisma = new PrismaClient({
    datasourceUrl,
    ...(accelerateUrl ? { accelerateUrl } : {}),
})

export { prisma }