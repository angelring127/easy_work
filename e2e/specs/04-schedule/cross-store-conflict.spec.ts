import { test, expect } from '../../fixtures/auth.fixture';
import {
  addDays,
  format,
  startOfWeek,
} from 'date-fns';
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

test.describe('Cross-store Schedule Conflict', () => {
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

  test('week grid shows other-store marker and blocks overlapping assignment', async ({
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

    const workerEmail = `cross-store-user-${Date.now()}@workeasy.test`;
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
      name: 'Alpha Morning Shift',
      startMin: 9 * 60,
      endMin: 13 * 60,
    });
    const targetWorkItemName = `Overlap Shift ${Date.now()}`;
    await createWorkItem(targetStore.id, {
      name: targetWorkItemName,
      startMin: 11 * 60,
      endMin: 15 * 60,
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

    await masterPage.goto('/en/dashboard');
    await masterPage.goto('/en/schedule');
    await masterPage.waitForLoadState('networkidle');

    const noWorkItemsDialog = masterPage.getByRole('dialog');
    if (await noWorkItemsDialog.isVisible().catch(() => false)) {
      const cancelButton = noWorkItemsDialog.getByRole('button', { name: /cancel/i }).first();
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

    const userRow = masterPage
      .locator('div.grid')
      .filter({ has: masterPage.getByText(workerName) })
      .first();
    const mondayCell = userRow.locator(':scope > div').nth(1);

    await expect(mondayCell.getByText(/other:/i)).toBeVisible();

    await mondayCell.click();

    const scheduleDialog = masterPage.getByRole('dialog').filter({
      has: masterPage.getByText(/select work item/i),
    });
    await scheduleDialog.getByRole('combobox').first().click();
    await masterPage.getByRole('option', { name: targetWorkItemName }).click();

    await expect(
      masterPage.getByRole('heading', { name: /cross-store schedule conflict/i })
    ).toBeVisible();
    await expect(masterPage.getByText(sourceStore.name)).toBeVisible();
    await expect(masterPage.getByText('09:00 - 13:00')).toBeVisible();

    const { data: targetAssignments, error: targetAssignmentsError } = await adminClient
      .from('schedule_assignments')
      .select('id')
      .eq('store_id', targetStore.id)
      .eq('user_id', targetStoreUser.id)
      .eq('date', mondayDate);

    expect(targetAssignmentsError).toBeNull();
    expect(targetAssignments || []).toHaveLength(0);
  });
});
