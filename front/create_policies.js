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
      console.log(`Setting RLS policy on public."${table}"...`);
      
      // Drop policy if it exists
      await client.query(`DROP POLICY IF EXISTS "Block all API access" ON public."${table}";`);
      
      // Create policy that blocks everything for everyone (except table owner who bypasses RLS)
      await client.query(`CREATE POLICY "Block all API access" ON public."${table}" FOR ALL USING (false);`);
      
      console.log(`Policy created on public."${table}".`);
    }

    console.log('\nAll policies created successfully.');

    // Query to check policies of the tables
    const res = await client.query(`
      SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename IN (${TABLES.map(t => `'${t}'`).join(', ')});
    `);

    console.log('\nStatus of policies in PostgreSQL:');
    res.rows.forEach(row => {
      console.log(`- ${row.tablename}: Policy="${row.policyname}", Roles=${row.roles}, Cmd=${row.cmd}, Qual=${row.qual}`);
    });

  } catch (err) {
    console.error('Error during execution:', err);
  } finally {
    await client.end();
  }
}

main();
