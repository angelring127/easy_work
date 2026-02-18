import { Page, Locator } from '@playwright/test';

export class SignupPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly passwordConfirmInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly loginLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('input[name="email"], input[type="email"]').first();
    this.passwordInput = page.locator('input[name="password"], input[type="password"]').first();
    this.passwordConfirmInput = page.locator('input[name="confirmPassword"], input[name="password_confirm"]');
    this.submitButton = page.locator('button[type="submit"]');
    this.errorMessage = page.locator('[role="alert"], .error, .text-red-500, .text-destructive');
    this.loginLink = page.locator('a[href*="login"]');
  }

  async goto(locale: string = 'en') {
    await this.page.goto(`/${locale}/signup`);
    await this.page.waitForLoadState('networkidle');
  }

  async signup(email: string, password: string, confirmPassword?: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);

    if (confirmPassword && await this.passwordConfirmInput.isVisible()) {
      await this.passwordConfirmInput.fill(confirmPassword);
    }

    await this.submitButton.click();
  }

  async waitForSuccess() {
    await this.page.waitForURL(/\/signup-complete|\/dashboard/, { timeout: 10000 });
  }

  async waitForError() {
    await this.errorMessage.waitFor({ state: 'visible', timeout: 5000 });
  }

  async getErrorText(): Promise<string> {
    return await this.errorMessage.textContent() || '';
  }
}
