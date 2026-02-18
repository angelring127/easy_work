import { test, expect } from '@playwright/test';
import { SignupPage } from '../../pages/signup.page';
import { LoginPage } from '../../pages/login.page';
import { DashboardPage } from '../../pages/dashboard.page';
import { deleteTestUser } from '../../utils/database';

test.describe('Critical Path: Signup to Login to Dashboard', () => {
  const testEmail = `test-critical-${Date.now()}@workeasy.test`;
  const testPassword = 'TestPassword123!';

  test.afterAll(async () => {
    await deleteTestUser(testEmail);
  });

  test('should complete full user journey from signup to dashboard', async ({ page }) => {
    const signupPage = new SignupPage(page);
    await signupPage.goto('en');

    await signupPage.signup(testEmail, testPassword, testPassword);

    await page.waitForURL(/\/signup-complete|\/dashboard|\/login/, { timeout: 15000 });

    const currentUrl = page.url();
    if (currentUrl.includes('/signup-complete') || currentUrl.includes('/login')) {
      const loginPage = new LoginPage(page);
      if (currentUrl.includes('/signup-complete')) {
        await loginPage.goto('en');
      }

      await loginPage.login(testEmail, testPassword);
      await loginPage.waitForDashboard();
    }

    const dashboardPage = new DashboardPage(page);
    await dashboardPage.waitForLoad();

    expect(await dashboardPage.isDashboardPage()).toBeTruthy();
  });
});
