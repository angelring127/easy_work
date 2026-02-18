import { test as base, Page } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { DashboardPage } from '../pages/dashboard.page';

type AuthFixtures = {
  authenticatedPage: Page;
  masterPage: Page;
  subManagerPage: Page;
  partTimerPage: Page;
  realUserPage: Page;
};

async function loginAs(page: Page, email: string, password: string): Promise<void> {
  const loginPage = new LoginPage(page);
  await loginPage.goto('en');
  await loginPage.login(email, password);
  await loginPage.waitForDashboard();

  const dashboardPage = new DashboardPage(page);
  await dashboardPage.waitForLoad();
}

export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, use) => {
    const email = process.env.TEST_MASTER_EMAIL || 'test-master@workeasy.test';
    const password = process.env.TEST_MASTER_PASSWORD || 'TestPassword123!';

    await loginAs(page, email, password);
    await use(page);
  },

  masterPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    const email = process.env.TEST_MASTER_EMAIL || 'test-master@workeasy.test';
    const password = process.env.TEST_MASTER_PASSWORD || 'TestPassword123!';

    await loginAs(page, email, password);
    await use(page);

    await context.close();
  },

  subManagerPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    const email = process.env.TEST_SUB_MANAGER_EMAIL || 'test-submanager@workeasy.test';
    const password = process.env.TEST_SUB_MANAGER_PASSWORD || 'TestPassword123!';

    await loginAs(page, email, password);
    await use(page);

    await context.close();
  },

  partTimerPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    const email = process.env.TEST_PART_TIMER_EMAIL || 'test-parttimer@workeasy.test';
    const password = process.env.TEST_PART_TIMER_PASSWORD || 'TestPassword123!';

    await loginAs(page, email, password);
    await use(page);

    await context.close();
  },

  realUserPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    const email = process.env.REAL_USER_EMAIL;
    const password = process.env.REAL_USER_PASSWORD;

    if (!email || !password) {
      throw new Error('REAL_USER_EMAIL and REAL_USER_PASSWORD must be set in .env.test');
    }

    await loginAs(page, email, password);
    await use(page);

    await context.close();
  },
});

export { expect } from '@playwright/test';
