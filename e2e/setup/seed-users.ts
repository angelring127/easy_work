import * as dotenv from 'dotenv';
import { createTestUser, getAdminClient } from '../utils/database';

dotenv.config({ path: '.env.test' });

const TEST_USERS = [
  {
    email: process.env.TEST_MASTER_EMAIL || 'test-master@workeasy.test',
    password: process.env.TEST_MASTER_PASSWORD || 'TestPassword123!',
    role: 'MASTER',
  },
  {
    email: process.env.TEST_SUB_MANAGER_EMAIL || 'test-submanager@workeasy.test',
    password: process.env.TEST_SUB_MANAGER_PASSWORD || 'TestPassword123!',
    role: 'SUB_MANAGER',
  },
  {
    email: process.env.TEST_PART_TIMER_EMAIL || 'test-parttimer@workeasy.test',
    password: process.env.TEST_PART_TIMER_PASSWORD || 'TestPassword123!',
    role: 'PART_TIMER',
  },
];

async function seedTestUsers() {
  console.log('Starting test user seed...');

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('ERROR: Missing required environment variables');
    console.error('Please create .env.test file based on .env.test.example');
    process.exit(1);
  }

  try {
    const adminClient = getAdminClient();

    const { data: healthCheck } = await adminClient.from('stores').select('count').limit(1);
    if (healthCheck === null) {
      console.error('ERROR: Could not connect to Supabase. Check your credentials.');
      process.exit(1);
    }
    console.log('✓ Connected to Supabase successfully');

    for (const testUser of TEST_USERS) {
      try {
        await createTestUser(testUser.email, testUser.password);
        console.log(`✓ ${testUser.role} user created/verified: ${testUser.email}`);
      } catch (error) {
        console.error(`✗ Failed to create ${testUser.role} user:`, error);
      }
    }

    console.log('\nTest user seed completed successfully!');
    console.log('\nYou can now run tests with:');
    console.log('  npm run test:e2e');
  } catch (error) {
    console.error('Fatal error during seed:', error);
    process.exit(1);
  }
}

seedTestUsers();
