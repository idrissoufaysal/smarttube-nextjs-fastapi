const { Client } = require('pg');
require('dotenv').config();

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  await client.connect();

  console.log('Clearing old userId values to allow foreign key creation...');
  
  try {
    await client.query('UPDATE "QuizAttempt" SET "userId" = null;');
    console.log('Cleared QuizAttempt.userId');
    
    await client.query('UPDATE "ChatMessage" SET "userId" = null;');
    console.log('Cleared ChatMessage.userId');
    
    await client.query('UPDATE "Video" SET "userId" = null;');
    console.log('Cleared Video.userId');
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

main();
