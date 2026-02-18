import { test as base } from './auth.fixture';
import { createTestStore, deleteTestStore, getTestUserByEmail } from '../utils/database';
import { generateStoreData, generateStoreCode } from '../utils/test-data-factory';

export type TestStore = {
  id: string;
  name: string;
  storeCode: string;
};

type StoreFixtures = {
  testStore: TestStore;
};

export const test = base.extend<StoreFixtures>({
  testStore: async ({}, use) => {
    const masterEmail = process.env.TEST_MASTER_EMAIL || 'test-master@workeasy.test';
    const masterUser = await getTestUserByEmail(masterEmail);

    if (!masterUser) {
      throw new Error(`Master user not found: ${masterEmail}. Run 'npm run seed:test-users' first.`);
    }

    const storeData = generateStoreData();
    const storeCode = generateStoreCode();

    const store = await createTestStore(masterUser.id, storeData.name, storeCode);

    await use({
      id: store.id,
      name: store.name,
      storeCode: storeCode,
    });

    await deleteTestStore(store.id);
  },
});

export { expect } from '@playwright/test';
