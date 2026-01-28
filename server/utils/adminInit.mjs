/**
 * Admin Initialization Utility
 * 
 * Ensures a default admin user exists in the database.
 * Called during server startup.
 * 
 * Note: This uses Prisma Accelerate which may have cached schema.
 * If the database was recently reset, run `node prisma/seed.mjs` instead.
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

// Default admin credentials
const DEFAULT_ADMIN = {
  email: 'admin@delipucash.com',
  password: 'admin123456',
  firstName: 'Admin',
  lastName: 'User',
  phone: '+256 700 000 001',
  role: 'ADMIN',
};

/**
 * Ensures the default admin user exists in the database.
 * Creates one if it doesn't exist, otherwise logs that it already exists.
 * Uses direct database connection to avoid Accelerate cache issues.
 * 
 * @returns {Promise<void>}
 */
export async function ensureDefaultAdminExists() {
  console.log('🔐 Checking for default admin user...');
  
  // Use direct database connection (bypasses Accelerate cache)
  const connectionString = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;

  if (!connectionString) {
    console.log('⚠️ No database URL configured. Skipping admin check.');
    return;
  }

  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    // Check if admin already exists
    const existingAdmin = await prisma.appUser.findUnique({
      where: { email: DEFAULT_ADMIN.email },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });

    if (existingAdmin) {
      console.log('✅ Default admin user exists:', existingAdmin.email);
      return;
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(DEFAULT_ADMIN.password, 10);
    
    // Create the admin user
    const admin = await prisma.appUser.create({
      data: {
        email: DEFAULT_ADMIN.email,
        password: hashedPassword,
        firstName: DEFAULT_ADMIN.firstName,
        lastName: DEFAULT_ADMIN.lastName,
        phone: DEFAULT_ADMIN.phone,
        role: DEFAULT_ADMIN.role,
        points: 100000, // Give admin some initial points
        subscriptionStatus: 'ACTIVE',
        surveysubscriptionStatus: 'ACTIVE',
        avatar: 'https://ui-avatars.com/api/?name=Admin&background=6366f1&color=fff&bold=true',
        privacySettings: { showEmail: false, showPhone: false },
      },
    });

    console.log('✅ Default admin user created successfully!');
    console.log('   📧 Email:', admin.email);
    console.log('   🔑 Password: admin123456 (change this in production!)');
    console.log('   👤 Name:', `${admin.firstName} ${admin.lastName}`);
    console.log('   🎭 Role:', admin.role);
  } catch (error) {
    // Don't crash the server if admin creation fails
    // This could happen if the database isn't ready yet
    console.error('⚠️ Could not ensure admin user exists:', error.message);
    console.log('   You can create the admin manually by running: node prisma/seed.mjs');
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

/**
 * Get admin credentials for documentation/testing
 */
export const getDefaultAdminCredentials = () => ({
  email: DEFAULT_ADMIN.email,
  password: DEFAULT_ADMIN.password,
});

export default { ensureDefaultAdminExists, getDefaultAdminCredentials };
