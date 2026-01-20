import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

/**
 * Prisma 7 Configuration
 * 
 * For Accelerate users:
 * - ACCELERATE_URL: prisma://accelerate.prisma-data.net/?api_key=YOUR_KEY (for runtime)
 * - DIRECT_DATABASE_URL: Your direct MongoDB connection (for migrations)
 * 
 * Without Accelerate:
 * - DATABASE_URL: Your direct MongoDB connection
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  
  // Use direct database URL for migrations (required for Accelerate setup)
  datasource: {
    url: env('DIRECT_DATABASE_URL') || env('DATABASE_URL'),
  },
});
