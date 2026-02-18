import { test, expect } from '../../fixtures/auth.fixture';
import { StoreCreatePage } from '../../pages/store-create.page';
import { StoreListPage } from '../../pages/store-list.page';
import { generateStoreData } from '../../utils/test-data-factory';
import { deleteStoreViaDB, getStoreIdByNameFromDB } from '../../utils/api-helpers';

test.describe('Store Creation', () => {
  let createdStoreIds: string[] = [];

  test.afterAll(async () => {
    for (const storeId of createdStoreIds) {
      await deleteStoreViaDB(storeId);
    }
  });

  test('MASTER user can create store successfully', async ({ masterPage }) => {
    const storeCreatePage = new StoreCreatePage(masterPage);
    const storeListPage = new StoreListPage(masterPage);

    const storeData = generateStoreData();

    await storeCreatePage.goto('en');
    expect(await storeCreatePage.isCreatePage()).toBeTruthy();

    await storeCreatePage.fillStoreForm(storeData);
    await storeCreatePage.clickCreate();

    await storeCreatePage.waitForSuccess();

    expect(masterPage.url()).toContain('/stores');

    await storeListPage.waitForLoad();
    const hasStore = await storeListPage.hasStoreWithName(storeData.name);
    expect(hasStore).toBeTruthy();

    const storeId = await getStoreIdByNameFromDB(storeData.name);
    if (storeId) {
      createdStoreIds.push(storeId);
    }
  });

  test('Should show validation error with empty store name', async ({ masterPage }) => {
    const storeCreatePage = new StoreCreatePage(masterPage);

    await storeCreatePage.goto('en');

    await storeCreatePage.clickCreate();

    const isStillOnCreatePage = await storeCreatePage.isCreatePage();
    expect(isStillOnCreatePage).toBeTruthy();
  });

  test('PART_TIMER user cannot access store creation page', async ({ partTimerPage }) => {
    await partTimerPage.goto('/en/stores/create');

    await partTimerPage.waitForTimeout(2000);

    const currentUrl = partTimerPage.url();
    expect(currentUrl).not.toContain('/stores/create');
  });

  test('SUB_MANAGER user cannot create store', async ({ subManagerPage }) => {
    await subManagerPage.goto('/en/stores/create');

    await subManagerPage.waitForTimeout(2000);

    const currentUrl = subManagerPage.url();
    expect(currentUrl).not.toContain('/stores/create');
  });

  test('Should create store with minimal data (name only)', async ({ masterPage }) => {
    const storeCreatePage = new StoreCreatePage(masterPage);
    const storeListPage = new StoreListPage(masterPage);

    const storeData = generateStoreData({
      description: undefined,
      address: undefined,
      phone: undefined,
    });

    await storeCreatePage.goto('en');

    await storeCreatePage.submitFormWithData(storeData);

    await storeCreatePage.waitForSuccess();

    expect(masterPage.url()).toContain('/stores');

    await storeListPage.waitForLoad();
    const hasStore = await storeListPage.hasStoreWithName(storeData.name);
    expect(hasStore).toBeTruthy();

    const storeId = await getStoreIdByNameFromDB(storeData.name);
    if (storeId) {
      createdStoreIds.push(storeId);
    }
  });

  test('Should create store in different locales', async ({ masterPage }) => {
    const locales = ['ko', 'en', 'ja'];

    for (const locale of locales) {
      const storeCreatePage = new StoreCreatePage(masterPage);
      const storeListPage = new StoreListPage(masterPage);

      const storeData = generateStoreData({
        name: `${generateStoreData().name}-${locale}`,
      });

      await storeCreatePage.goto(locale);

      await storeCreatePage.submitFormWithData(storeData);

      await storeCreatePage.waitForSuccess();

      expect(masterPage.url()).toContain(`/${locale}/stores`);

      await storeListPage.waitForLoad();
      const hasStore = await storeListPage.hasStoreWithName(storeData.name);
      expect(hasStore).toBeTruthy();

      const storeId = await getStoreIdByNameFromDB(storeData.name);
      if (storeId) {
        createdStoreIds.push(storeId);
      }
    }
  });
});
