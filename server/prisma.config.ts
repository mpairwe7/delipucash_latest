import 'dotenv/config'
import { defineConfig, env } from '@prisma/config'

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    // Prefer DIRECT_URL for migrations (non-pooled); fall back to pooled DATABASE_URL
    url: env('DIRECT_DATABASE_URL') ?? env('DATABASE_URL'),
  },
})
