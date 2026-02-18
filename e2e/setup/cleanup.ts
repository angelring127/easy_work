import * as dotenv from 'dotenv';
import { cleanupTestData, deleteTestUser } from '../utils/database';

dotenv.config({ path: '.env.test' });

const TEST_USERS = [
  process.env.TEST_MASTER_EMAIL || 'test-master@workeasy.test',
  process.env.TEST_SUB_MANAGER_EMAIL || 'test-submanager@workeasy.test',
  process.env.TEST_PART_TIMER_EMAIL || 'test-parttimer@workeasy.test',
];

async function cleanup() {
  console.log('Starting test data cleanup...');

  try {
    await cleanupTestData('test-');
    console.log('✓ Cleaned up test stores and data');

    for (const email of TEST_USERS) {
      await deleteTestUser(email);
    }
    console.log('✓ Cleaned up test users');

    console.log('\nCleanup completed successfully!');
  } catch (error) {
    console.error('Error during cleanup:', error);
    process.exit(1);
  }
}

cleanup();
