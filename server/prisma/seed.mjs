/**
 * Prisma Seed Script
 * 
 * Creates default admin user and any other seed data required for the application.
 * 
 * Run with: npx prisma db seed
 * Or manually: node prisma/seed.mjs
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import bcrypt from 'bcryptjs';

// Use direct database connection for seeding (bypasses Accelerate cache)
const connectionString = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Default admin credentials
const DEFAULT_ADMIN = {
  email: 'admin@delipucash.com',
  password: 'admin123456',
  firstName: 'Admin',
  lastName: 'User',
  phone: '+256 700 000 001',
  role: 'ADMIN',
};

async function createDefaultAdmin() {
  console.log('🔧 Checking for default admin user...');
  
  try {
    // Check if admin already exists
    const existingAdmin = await prisma.appUser.findUnique({
      where: { email: DEFAULT_ADMIN.email },
    });

    if (existingAdmin) {
      console.log('✅ Admin user already exists:', existingAdmin.email);
      return existingAdmin;
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
    console.log('   🔑 Password:', DEFAULT_ADMIN.password);
    console.log('   👤 Name:', `${admin.firstName} ${admin.lastName}`);
    console.log('   🎭 Role:', admin.role);
    
    return admin;
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    throw error;
  }
}

async function seedAppConfig() {
  console.log('Checking for AppConfig singleton...');

  const config = await prisma.appConfig.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      surveyCompletionPoints: 10,
      pointsToCashNumerator: 2500,
      pointsToCashDenominator: 20,
      minWithdrawalPoints: 50,
    },
  });

  console.log('AppConfig ready:', {
    surveyCompletionPoints: config.surveyCompletionPoints,
    rate: `${config.pointsToCashNumerator} UGX per ${config.pointsToCashDenominator} points`,
    minWithdrawalPoints: config.minWithdrawalPoints,
  });
}

async function main() {
  console.log('Starting database seeding...\n');

  // Create default admin
  await createDefaultAdmin();

  // Seed AppConfig singleton
  await seedAppConfig();

  console.log('\nDatabase seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
