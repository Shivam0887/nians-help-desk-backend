import app from './src/app.ts';
import { env } from './src/config/env.ts';
import prisma from './src/config/db.ts';

async function main() {
  try {
    // Verify database connection
    await prisma.$connect();
    console.log('Connected to PostgreSQL');

    app.listen(env.PORT, () => {
      console.log(`Server running on http://localhost:${env.PORT}`);
      console.log(`Environment: ${env.NODE_ENV}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

main();
