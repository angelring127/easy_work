import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/login.page';

const CAPTURE_TAG = process.env.CAPTURE_TAG || 'before';

test.describe('Mobile Store Edit Tabs', () => {
  test('capture tab layout on mobile store edit page', async ({ page }) => {
    const email = process.env.TEST_MASTER_EMAIL || 'test-master@workeasy.test';
    const password = process.env.TEST_MASTER_PASSWORD || 'TestPassword123!';

    await page.setViewportSize({ width: 390, height: 844 });

    const loginPage = new LoginPage(page);
    await loginPage.goto('ko');
    await loginPage.login(email, password);
    await loginPage.waitForDashboard();

    await page.goto('http://localhost:3000/ko/stores');
    await page.waitForLoadState('networkidle');

    const viewButton = page
      .locator('button')
      .filter({ hasText: /보기|View|表示/ })
      .first();
    await expect(viewButton).toBeVisible();
    await viewButton.click();

    await page.waitForURL(/\/stores\/[^/]+$/);
    const editButton = page
      .locator('button')
      .filter({ hasText: /수정|Edit|編集|store\.edit/ })
      .first();
    await expect(editButton).toBeVisible();
    await editButton.click();

    await page.waitForURL(/\/stores\/[^/]+\/edit/);
    await page.waitForLoadState('networkidle');

    const tabList = page.locator('[role="tablist"]');
    await expect(tabList).toBeVisible();

    await page.screenshot({
      path: `test-results/mobile-store-edit-tabs-${CAPTURE_TAG}.png`,
      fullPage: true,
    });
  });
});
