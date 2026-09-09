const { prisma } = require('../../lib/db');

async function test() {
  console.log("DATABASE_URL in env:", process.env.DATABASE_URL);
  try {
    const count = await prisma.video.count();
    console.log("Database connection successful! Video count:", count);
  } catch (err) {
    console.error("Database connection failed:", err);
  }
}

test();
