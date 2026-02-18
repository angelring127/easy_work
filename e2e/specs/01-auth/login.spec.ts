import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/login.page';
import { DashboardPage } from '../../pages/dashboard.page';

test.describe('Login Flow', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto('en');
  });

  test('should display login page correctly', async () => {
    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.submitButton).toBeVisible();
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    const email = process.env.TEST_MASTER_EMAIL || 'test-master@workeasy.test';
    const password = process.env.TEST_MASTER_PASSWORD || 'TestPassword123!';

    await loginPage.login(email, password);
    await loginPage.waitForDashboard();

    const dashboardPage = new DashboardPage(page);
    expect(await dashboardPage.isDashboardPage()).toBeTruthy();
  });

  test('should show error with invalid credentials', async () => {
    await loginPage.login('invalid@example.com', 'wrongpassword');

    await loginPage.waitForError();
    const errorText = await loginPage.getErrorText();
    expect(errorText.length).toBeGreaterThan(0);
  });

  test('should show error with empty email', async () => {
    await loginPage.login('', 'password123');

    const isStillOnLogin = await loginPage.isLoginPage();
    expect(isStillOnLogin).toBeTruthy();
  });

  test('should show error with empty password', async () => {
    await loginPage.login('test@example.com', '');

    const isStillOnLogin = await loginPage.isLoginPage();
    expect(isStillOnLogin).toBeTruthy();
  });

  test('should navigate to signup page', async ({ page }) => {
    if (await loginPage.signupLink.isVisible()) {
      await loginPage.signupLink.click();
      await page.waitForURL(/\/signup/, { timeout: 5000 });
      expect(page.url()).toContain('/signup');
    }
  });
});

test.describe('Login with different locales', () => {
  test('should login in Korean locale', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto('ko');

    const email = process.env.TEST_MASTER_EMAIL || 'test-master@workeasy.test';
    const password = process.env.TEST_MASTER_PASSWORD || 'TestPassword123!';

    await loginPage.login(email, password);
    await loginPage.waitForDashboard();

    expect(page.url()).toContain('/ko/dashboard');
  });

  test('should login in Japanese locale', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto('ja');

    const email = process.env.TEST_MASTER_EMAIL || 'test-master@workeasy.test';
    const password = process.env.TEST_MASTER_PASSWORD || 'TestPassword123!';

    await loginPage.login(email, password);
    await loginPage.waitForDashboard();

    expect(page.url()).toContain('/ja/dashboard');
  });
});
