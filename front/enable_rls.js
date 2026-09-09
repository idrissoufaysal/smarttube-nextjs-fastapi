const { Client } = require('pg');
require('dotenv').config();

const TABLES = [
  'Segment',
  'Quiz',
  'QuizQuestion',
  'QuizAttempt',
  'ChatMessage',
  'User',
  'Video'
];

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to DB');

    for (const table of TABLES) {
      console.log(`Enabling RLS on public."${table}"...`);
      await client.query(`ALTER TABLE public."${table}" ENABLE ROW LEVEL SECURITY;`);
      console.log(`RLS enabled on public."${table}".`);
    }

    console.log('\nAll tables updated successfully.');

    // Query to check RLS status of the tables
    const res = await client.query(`
      SELECT relname AS table_name, relrowsecurity AS rls_enabled, relforcerowsecurity AS rls_forced
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname IN (${TABLES.map(t => `'${t}'`).join(', ')});
    `);

    console.log('\nStatus of tables in PostgreSQL:');
    res.rows.forEach(row => {
      console.log(`- ${row.table_name}: RLS_ENABLED=${row.rls_enabled}, RLS_FORCED=${row.rls_forced}`);
    });

  } catch (err) {
    console.error('Error during execution:', err);
  } finally {
    await client.end();
  }
}

main();
