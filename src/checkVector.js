// src/checkVector.js
import prisma from './lib/prisma.js';
import { Prisma } from '@prisma/client';

async function checkVectorSupport() {
  try {
    console.log('Connecting to database to check for "vector" extension...');

    // This is the raw SQL query to ask PostgreSQL about its extensions
    const query = Prisma.sql`SELECT 1 FROM pg_extension WHERE extname = 'vector'`;

    // We use $queryRaw to run the SQL
    const result = await prisma.$queryRaw(query);

    // If the query returns one or more rows, the extension exists
    if (result.length > 0) {
      console.log("✅ Success: 'vector' extension is installed and recognized.");
      return true;
    } else {
      console.log("❌ Failure: 'vector' extension is NOT found.");
      console.log('Please go to your Neon SQL Editor and run: CREATE EXTENSION vector;');
      return false;
    }
  } catch (e) {
    console.error('Error while checking for vector extension:', e.message);
    return false;
  } finally {
    // Always disconnect the Prisma client when the script is done
    await prisma.$disconnect();
  }
}

// Run the function
checkVectorSupport();