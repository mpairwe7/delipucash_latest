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
const DEFAULT_ADMINS = [
  {
    email: 'admin@delipucash.com',
    password: 'admin123456',
    firstName: 'Admin',
    lastName: 'User',
    phone: '+256 700 000 001',
    role: 'ADMIN',
  },
  {
    email: 'mpairwelauben75@gmail.com',
    password: 'alien123.com',
    firstName: 'Mpairwe',
    lastName: 'Lauben',
    phone: '+256 773 336 896',
    role: 'ADMIN',
  },
];

async function createDefaultAdmins() {
  console.log('🔧 Checking for default admin users...');

  const admins = [];

  for (const adminDef of DEFAULT_ADMINS) {
    try {
      // Check if admin already exists
      const existingAdmin = await prisma.appUser.findUnique({
        where: { email: adminDef.email },
      });

      if (existingAdmin) {
        console.log('✅ Admin user already exists:', existingAdmin.email);
        admins.push(existingAdmin);
        continue;
      }

      // Hash the password
      const hashedPassword = await bcrypt.hash(adminDef.password, 10);

      // Create the admin user
      const admin = await prisma.appUser.create({
        data: {
          email: adminDef.email,
          password: hashedPassword,
          firstName: adminDef.firstName,
          lastName: adminDef.lastName,
          phone: adminDef.phone,
          role: adminDef.role,
          points: 100000,
          subscriptionStatus: 'ACTIVE',
          surveysubscriptionStatus: 'ACTIVE',
          avatar: `https://ui-avatars.com/api/?name=${adminDef.firstName}+${adminDef.lastName}&background=6366f1&color=fff&bold=true`,
          privacySettings: { showEmail: false, showPhone: false },
        },
      });

      console.log('✅ Admin user created successfully!');
      console.log('   📧 Email:', admin.email);
      console.log('   👤 Name:', `${admin.firstName} ${admin.lastName}`);
      console.log('   🎭 Role:', admin.role);

      admins.push(admin);
    } catch (error) {
      console.error(`❌ Error creating admin user ${adminDef.email}:`, error);
      throw error;
    }
  }

  return admins[0]; // Return first admin for reward question seeding
}

async function seedAppConfig() {
  console.log('Checking for AppConfig singleton...');

  const config = await prisma.appConfig.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      surveyCompletionPoints: 10,
      pointsToCashNumerator: 2000,
      pointsToCashDenominator: 50,
      minWithdrawalPoints: 50,
      defaultRegularRewardAmount: 200,
      defaultInstantRewardAmount: 500,
    },
  });

  console.log('AppConfig ready:', {
    surveyCompletionPoints: config.surveyCompletionPoints,
    rate: `${config.pointsToCashNumerator} UGX per ${config.pointsToCashDenominator} points`,
    minWithdrawalPoints: config.minWithdrawalPoints,
  });
}

async function seedRewardQuestions(adminId) {
  console.log('Seeding reward questions (including text_input)...');

  const questions = [
    // Multiple choice — regular
    {
      text: 'What is the largest lake in Africa by surface area?',
      options: { A: 'Lake Tanganyika', B: 'Lake Victoria', C: 'Lake Malawi', D: 'Lake Chad' },
      correctAnswer: 'B',
      questionType: 'multiple_choice',
      matchMode: 'exact',
      rewardAmount: 200,
      isInstantReward: false,
      maxWinners: 50,
      isActive: true,
      userId: adminId,
    },
    // Text input — regular (case insensitive, multiple accepted)
    {
      text: 'What is the capital city of Uganda?',
      options: { placeholder: 'Enter the city name', hint: 'Think about East Africa', maxLength: 50 },
      correctAnswer: 'Kampala|kampala',
      questionType: 'text_input',
      matchMode: 'case_insensitive',
      rewardAmount: 200,
      isInstantReward: false,
      maxWinners: 50,
      isActive: true,
      userId: adminId,
    },
    // Multiple choice — instant
    {
      text: 'Which planet is closest to the Sun?',
      options: { A: 'Venus', B: 'Earth', C: 'Mercury', D: 'Mars' },
      correctAnswer: 'C',
      questionType: 'multiple_choice',
      matchMode: 'exact',
      rewardAmount: 1000,
      isInstantReward: true,
      maxWinners: 5,
      isActive: true,
      userId: adminId,
      paymentProvider: 'MTN',
      phoneNumber: '+256700000001',
      expiryTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
    // Text input — instant (exact match, multiple accepted spellings)
    {
      text: 'Name the chemical symbol for gold.',
      options: { placeholder: 'Enter chemical symbol', maxLength: 5 },
      correctAnswer: 'Au',
      questionType: 'text_input',
      matchMode: 'exact',
      rewardAmount: 1000,
      isInstantReward: true,
      maxWinners: 3,
      isActive: true,
      userId: adminId,
      paymentProvider: 'MTN',
      phoneNumber: '+256700000001',
      expiryTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
    },
  ];

  for (const q of questions) {
    const existing = await prisma.rewardQuestion.findFirst({
      where: { text: q.text, userId: q.userId },
    });
    if (!existing) {
      await prisma.rewardQuestion.create({ data: q });
      console.log(`   Created: "${q.text}" (${q.questionType})`);
    } else {
      console.log(`   Skipped (exists): "${q.text}"`);
    }
  }
}

async function main() {
  console.log('Starting database seeding...\n');

  // Create default admins
  const admin = await createDefaultAdmins();

  // Seed AppConfig singleton
  await seedAppConfig();

  // Seed reward questions (requires admin user)
  await seedRewardQuestions(admin.id);

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
