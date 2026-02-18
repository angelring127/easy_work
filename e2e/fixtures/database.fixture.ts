import { test as base } from '@playwright/test';
import { getAdminClient } from '../utils/database';

export const test = base.extend({
  page: async ({ page }, use) => {
    await use(page);

    const adminClient = getAdminClient();

    try {
      await adminClient
        .from('stores')
        .delete()
        .ilike('name', 'test-store-%');

      await adminClient
        .from('invitations')
        .delete()
        .ilike('invited_email', 'test-invite-%');

      await adminClient
        .from('store_users')
        .delete()
        .ilike('name', '게스트-%');

      console.log('✓ Test data cleaned up after test');
    } catch (error) {
      console.warn('Warning: Failed to clean up test data:', error);
    }
  },
});

export { expect } from '@playwright/test';
