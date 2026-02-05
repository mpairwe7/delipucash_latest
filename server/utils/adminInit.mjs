/**
 * Admin Initialization Utility
 * 
 * Ensures a default admin user exists in the database.
 * Called during server startup.
 * 
 * Note: This uses Prisma Accelerate which may have cached schema.
 * If the database was recently reset, run `node prisma/seed.mjs` instead.
 */

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

  try {
    // Check if admin already exists
    const existingAdminQuery = 'SELECT id, email, "firstName", "lastName", role FROM "AppUser" WHERE email = $1';
    const existingAdminResult = await pool.query(existingAdminQuery, [DEFAULT_ADMIN.email]);

    if (existingAdminResult.rows.length > 0) {
      const existingAdmin = existingAdminResult.rows[0];
      console.log('✅ Default admin user exists:', existingAdmin.email);
      return;
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(DEFAULT_ADMIN.password, 10);
    
    // Create the admin user
    const createAdminQuery = `
      INSERT INTO "AppUser" (
        email, password, "firstName", "lastName", phone, role, points, 
        "subscriptionStatus", "surveysubscriptionStatus", avatar, "privacySettings"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, email, "firstName", "lastName", role
    `;
    const adminResult = await pool.query(createAdminQuery, [
      DEFAULT_ADMIN.email,
      hashedPassword,
      DEFAULT_ADMIN.firstName,
      DEFAULT_ADMIN.lastName,
      DEFAULT_ADMIN.phone,
      DEFAULT_ADMIN.role,
      100000, // points
      'ACTIVE', // subscriptionStatus
      'ACTIVE', // surveysubscriptionStatus
      'https://ui-avatars.com/api/?name=Admin&background=6366f1&color=fff&bold=true',
      JSON.stringify({ showEmail: false, showPhone: false }) // privacySettings
    ]);

    const admin = adminResult.rows[0];

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
