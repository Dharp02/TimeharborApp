/**
 * Run the auto-close orphaned sessions job once immediately.
 * 
 * Usage: cd express-api && npx ts-node scripts/runAutoClose.ts
 */
import sequelize from '../src/config/sequelize';
import { runAutoCloseNow } from '../src/jobs/autoCloseOrphanedSessions';

async function main() {
  await sequelize.authenticate();
  console.log('Connected. Running auto-close...');
  await runAutoCloseNow();
  console.log('Done.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
