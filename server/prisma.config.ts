import 'dotenv/config'
import { defineConfig, env } from '@prisma/config'

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    // Use DATABASE_URL for the client, as the app uses it
    url: env('DATABASE_URL'),
  },
})
