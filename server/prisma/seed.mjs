/**
 * Prisma Seed Script
 * 
 * Creates default admin user and any other seed data required for the application.
 * 
 * Run with: npx prisma db seed
 * Or manually: node prisma/seed.mjs
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

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

async function main() {
  console.log('🌱 Starting database seeding...\n');
  
  // Create default admin
  await createDefaultAdmin();
  
  console.log('\n✨ Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
