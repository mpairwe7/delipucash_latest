import 'dotenv/config';
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL || process.env.DIRECT_DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL (or DIRECT_DATABASE_URL) is required for Postgres connection');
}

// Postgres client for Supabase connection pooling or direct URL
const sql = postgres(connectionString);

export const checkDatabaseHealth = async () => {
  try {
    await sql`select 1`;
    return { status: 'healthy', timestamp: new Date().toISOString() };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
};

export default sql;
