import { test, expect } from '../../fixtures/auth.fixture';
import { addDays, format, startOfWeek } from 'date-fns';
import ExcelJS from 'exceljs';
import { readFile } from 'fs/promises';
import {
  addUserToStore,
  createScheduleAssignment,
  createTestStore,
  createTestUser,
  createWorkItem,
  deleteTestUser,
  getAdminClient,
  getTestUserByEmail,
} from '../../utils/database';
import { deleteStoreViaDB } from '../../utils/api-helpers';
import {
  generatePassword,
  generateStoreCode,
  generateStoreName,
  generateUserName,
} from '../../utils/test-data-factory';

const getCurrentWeekDate = (dayOffsetFromMonday: number) => {
  const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
  const targetDate = addDays(monday, dayOffsetFromMonday);
  return format(targetDate, 'yyyy-MM-dd');
};

test.describe('Cross-store Export', () => {
  const createdStoreIds: string[] = [];
  const createdUserEmails: string[] = [];

  test.afterEach(async () => {
    while (createdStoreIds.length > 0) {
      const storeId = createdStoreIds.pop();
      if (storeId) {
        await deleteStoreViaDB(storeId);
      }
    }

    while (createdUserEmails.length > 0) {
      const email = createdUserEmails.pop();
      if (email) {
        await deleteTestUser(email);
      }
    }
  });

  test('quick export xlsx and advanced export csv include cross-store marker and legend', async ({
    masterPage,
  }) => {
    const adminClient = getAdminClient();
    const masterEmail =
      process.env.TEST_MASTER_EMAIL || 'test-master@workeasy.test';
    const masterUser = await getTestUserByEmail(masterEmail);

    if (!masterUser) {
      throw new Error(`Master user not found: ${masterEmail}`);
    }

    const sourceStore = await createTestStore(
      masterUser.id,
      `source-${generateStoreName()}`,
      generateStoreCode()
    );
    createdStoreIds.push(sourceStore.id);

    const targetStore = await createTestStore(
      masterUser.id,
      `target-${generateStoreName()}`,
      generateStoreCode()
    );
    createdStoreIds.push(targetStore.id);

    const workerEmail = `cross-store-export-${Date.now()}@workeasy.test`;
    const workerPassword = generatePassword();
    const workerName = generateUserName();
    const worker = await createTestUser(workerEmail, workerPassword);
    createdUserEmails.push(workerEmail);

    const sourceStoreUser = await addUserToStore(
      sourceStore.id,
      worker.id,
      'PART_TIMER',
      masterUser.id,
      workerName
    );
    const targetStoreUser = await addUserToStore(
      targetStore.id,
      worker.id,
      'PART_TIMER',
      masterUser.id,
      workerName
    );

    const sourceWorkItem = await createWorkItem(sourceStore.id, {
      name: 'Source Export Shift',
      startMin: 9 * 60,
      endMin: 13 * 60,
    });
    const targetWorkItem = await createWorkItem(targetStore.id, {
      name: 'Target Export Shift',
      startMin: 15 * 60,
      endMin: 18 * 60,
    });

    const mondayDate = getCurrentWeekDate(0);
    await createScheduleAssignment({
      storeId: sourceStore.id,
      storeUserId: sourceStoreUser.id,
      workItemId: sourceWorkItem.id,
      date: mondayDate,
      startTime: '09:00',
      endTime: '13:00',
      createdBy: masterUser.id,
    });
    await createScheduleAssignment({
      storeId: targetStore.id,
      storeUserId: targetStoreUser.id,
      workItemId: targetWorkItem.id,
      date: mondayDate,
      startTime: '15:00',
      endTime: '18:00',
      createdBy: masterUser.id,
    });

    await masterPage.goto('/en/dashboard');
    await masterPage.goto('/en/schedule');
    await masterPage.waitForLoadState('networkidle');

    const noWorkItemsDialog = masterPage.getByRole('dialog');
    if (await noWorkItemsDialog.isVisible().catch(() => false)) {
      const cancelButton = noWorkItemsDialog
        .getByRole('button', { name: /cancel/i })
        .first();
      if (await cancelButton.isVisible().catch(() => false)) {
        await cancelButton.click();
      }
    }

    const switcherTrigger = masterPage
      .locator('header button')
      .filter({ hasText: /test-store-|source-|target-/i })
      .first();
    await switcherTrigger.click();

    const storeMenu = masterPage.getByRole('menu');
    await expect(storeMenu).toBeVisible();
    await storeMenu.evaluate((menuElement, targetStoreName) => {
      const targetItem = Array.from(
        menuElement.querySelectorAll('[role="menuitem"]')
      ).find((item) => item.textContent?.includes(String(targetStoreName)));

      if (!targetItem) {
        throw new Error(`Store menu item not found: ${String(targetStoreName)}`);
      }

      (targetItem as HTMLElement).scrollIntoView({ block: 'nearest' });
      (targetItem as HTMLElement).click();
    }, targetStore.name);

    await expect(masterPage.getByText(targetStore.name).first()).toBeVisible({
      timeout: 10000,
    });
    await expect(masterPage.getByText(workerName)).toBeVisible();
    await expect(masterPage.getByText(/other:/i)).toBeVisible();

    const quickDownloadPromise = masterPage.waitForEvent('download');
    await masterPage.getByRole('button', { name: /^export$/i }).click();
    const quickDownload = await quickDownloadPromise;
    const quickDownloadPath = await quickDownload.path();

    if (!quickDownloadPath) {
      throw new Error('Quick export download path is missing');
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(quickDownloadPath);
    const worksheet = workbook.worksheets[0];
    const worksheetValues = worksheet
      .getSheetValues()
      .flatMap((row) => (Array.isArray(row) ? row : []))
      .map((value) => String(value ?? ''));

    const legendEntry = worksheetValues.find((value) =>
      value.endsWith(`: ${sourceStore.name}`)
    );

    if (!legendEntry) {
      throw new Error(`Legend entry not found for ${sourceStore.name}`);
    }

    const sourceShortCode = legendEntry.replace(`: ${sourceStore.name}`, '');

    expect(worksheetValues).toContain('Cross-store Work Legend');
    expect(worksheetValues).toContain(legendEntry);
    expect(worksheetValues).toContain(`15:00 / ${sourceShortCode}`);

    await masterPage.getByRole('button', { name: /advanced settings/i }).click();
    const exportDialog = masterPage.getByRole('dialog');
    await exportDialog.getByRole('combobox').first().click();
    await masterPage.getByRole('option', { name: /^csv$/i }).click();

    const advancedDownloadPromise = masterPage.waitForEvent('download');
    await exportDialog.getByRole('button', { name: /^download$/i }).click();
    const advancedDownload = await advancedDownloadPromise;
    const advancedDownloadPath = await advancedDownload.path();

    if (!advancedDownloadPath) {
      throw new Error('Advanced export download path is missing');
    }

    const csvContent = await readFile(advancedDownloadPath, 'utf8');

    expect(csvContent).toContain('Cross-store Work Legend');
    expect(csvContent).toContain(legendEntry);
    expect(
      csvContent.includes(`"Target Export Shift\n${sourceShortCode}"`) ||
        csvContent.includes(`"Target Export Shift\r\n${sourceShortCode}"`)
    ).toBeTruthy();
  });
});
