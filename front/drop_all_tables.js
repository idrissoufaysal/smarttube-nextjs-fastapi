const { Client } = require('pg');
require('dotenv').config();

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to DB for dropping tables...');
    
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    if (res.rows.length === 0) {
      console.log('No tables found in public schema.');
    } else {
      for (let row of res.rows) {
        console.log(`Dropping table ${row.table_name}...`);
        await client.query(`DROP TABLE IF EXISTS "public"."${row.table_name}" CASCADE`);
      }
      console.log('All tables dropped successfully.');
    }
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

main();
