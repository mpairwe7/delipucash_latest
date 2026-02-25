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

// Notification templates seeded for every admin user
const ADMIN_NOTIFICATIONS = [
  {
    title: 'Welcome to DelipuCash! 🎊',
    body: 'Start earning rewards by completing surveys and answering questions!',
    type: 'WELCOME',
    priority: 'MEDIUM',
    icon: 'home',
    category: 'welcome',
    metadata: {},
  },
  {
    title: 'Subscription Active! ✅',
    body: 'Your Survey Premium subscription is now active. Enjoy premium features!',
    type: 'SUBSCRIPTION_ACTIVE',
    priority: 'HIGH',
    icon: 'shield-checkmark',
    category: 'subscription',
    metadata: { subscriptionType: 'Survey Premium' },
  },
  {
    title: 'Subscription Active! ✅',
    body: 'Your Video Premium subscription is now active. Enjoy premium features!',
    type: 'SUBSCRIPTION_ACTIVE',
    priority: 'HIGH',
    icon: 'shield-checkmark',
    category: 'subscription',
    metadata: { subscriptionType: 'Video Premium' },
  },
];

/**
 * Seeds welcome + subscription notifications for an admin user.
 * Silently ignores insert failures so admin creation is never blocked.
 */
async function seedAdminNotifications(pool, userId) {
  const sql = `
    INSERT INTO "Notification" (
      id, "userId", title, body, type, priority, icon, category, metadata,
      read, archived, delivered, "createdAt", "updatedAt"
    ) VALUES (
      gen_random_uuid(), $1, $2, $3, $4::"NotificationType", $5::"NotificationPriority",
      $6, $7, $8::jsonb, false, false, true, NOW(), NOW()
    )
  `;
  for (const notif of ADMIN_NOTIFICATIONS) {
    await pool.query(sql, [
      userId,
      notif.title,
      notif.body,
      notif.type,
      notif.priority,
      notif.icon,
      notif.category,
      JSON.stringify(notif.metadata),
    ]).catch(() => {}); // Don't fail admin creation if notification insert fails
  }
}

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

/**
 * Ensures the default admin user exists in the database.
 * Creates one if it doesn't exist, otherwise logs that it already exists.
 * Uses direct database connection to avoid Accelerate cache issues.
 * 
 * @returns {Promise<void>}
 */
export async function ensureDefaultAdminExists() {
  console.log('🔐 Checking for default admin users...');

  // Use direct database connection (bypasses Accelerate cache)
  const connectionString = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;

  if (!connectionString) {
    console.log('⚠️ No database URL configured. Skipping admin check.');
    return;
  }

  const pool = new pg.Pool({ connectionString });

  try {
    for (const adminDef of DEFAULT_ADMINS) {
      // Check if admin already exists
      const existingAdminQuery = 'SELECT id, email, "firstName", "lastName", role FROM "AppUser" WHERE email = $1';
      const existingAdminResult = await pool.query(existingAdminQuery, [adminDef.email]);

      if (existingAdminResult.rows.length > 0) {
        const existingAdmin = existingAdminResult.rows[0];
        console.log('✅ Admin user exists:', existingAdmin.email);

        // Ensure admin has at least one subscription notification
        // (fixes zero-badge and empty Subscription tab for bootstrapped admins)
        const notifCountResult = await pool.query(
          'SELECT COUNT(*) FROM "Notification" WHERE "userId" = $1 AND type = \'SUBSCRIPTION_ACTIVE\'',
          [existingAdmin.id]
        );
        if (parseInt(notifCountResult.rows[0].count, 10) === 0) {
          await seedAdminNotifications(pool, existingAdmin.id);
          console.log('   🔔 Seeded subscription notifications for', existingAdmin.email);
        }

        continue;
      }

      // Hash the password
      const hashedPassword = await bcrypt.hash(adminDef.password, 10);

      // Create the admin user
      // Raw SQL needs explicit id + updatedAt because Prisma's @default(uuid()) and @updatedAt
      // are client-level features that don't create DB-level defaults
      const createAdminQuery = `
        INSERT INTO "AppUser" (
          id, email, password, "firstName", "lastName", phone, role, points,
          "subscriptionStatus", "surveysubscriptionStatus", "videoSubscriptionStatus",
          avatar, "privacySettings", "createdAt", "updatedAt"
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW()
        )
        RETURNING id, email, "firstName", "lastName", role
      `;
      const adminResult = await pool.query(createAdminQuery, [
        adminDef.email,
        hashedPassword,
        adminDef.firstName,
        adminDef.lastName,
        adminDef.phone,
        adminDef.role,
        100000, // points
        'ACTIVE', // subscriptionStatus
        'ACTIVE', // surveysubscriptionStatus
        'ACTIVE', // videoSubscriptionStatus (admin gets all features)
        `https://ui-avatars.com/api/?name=${adminDef.firstName}+${adminDef.lastName}&background=6366f1&color=fff&bold=true`,
        JSON.stringify({ showEmail: false, showPhone: false }) // privacySettings
      ]);

      const admin = adminResult.rows[0];

      // Seed welcome + subscription notifications so bell badge is non-zero
      await seedAdminNotifications(pool, admin.id);

      console.log('✅ Admin user created successfully!');
      console.log('   📧 Email:', admin.email);
      console.log('   👤 Name:', `${admin.firstName} ${admin.lastName}`);
      console.log('   🎭 Role:', admin.role);
      console.log('   🔔 Notifications: 3 (welcome + 2 subscription activations)');
    }
  } catch (error) {
    // Don't crash the server if admin creation fails
    // This could happen if the database isn't ready yet
    console.error('⚠️ Could not ensure admin users exist:', error.message);
    console.log('   You can create admins manually by running: node prisma/seed.mjs');
  } finally {
    await pool.end();
  }
}

/**
 * Get admin credentials for documentation/testing
 */
export const getDefaultAdminCredentials = () =>
  DEFAULT_ADMINS.map(({ email, password }) => ({ email, password }));

export default { ensureDefaultAdminExists, getDefaultAdminCredentials };
