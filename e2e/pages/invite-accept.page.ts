import { Page, Locator } from '@playwright/test';

export class InviteAcceptPage {
  readonly page: Page;
  readonly nameInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly successMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.nameInput = page.locator('input[name="name"], input#name').first();
    this.passwordInput = page.locator('input[type="password"], input[name="password"]').first();
    this.submitButton = page.locator('button:has-text("초대 수락"), button:has-text("Accept"), button[type="submit"]');
    this.errorMessage = page.locator('[role="alert"], .text-red-500, .text-destructive');
    this.successMessage = page.locator('[role="status"], .toast, [data-sonner-toast]');
  }

  async goto(token: string) {
    await this.page.goto(`/invites/verify-email?token=${token}`);
    await this.page.waitForLoadState('networkidle');
  }

  async gotoDirectly(locale: string = 'en') {
    await this.page.goto(`/${locale}/invites/verify-email`);
    await this.page.waitForLoadState('networkidle');
  }

  async fillAcceptForm(name: string, password: string) {
    await this.nameInput.fill(name);
    await this.passwordInput.fill(password);
  }

  async submit() {
    await this.submitButton.click();
  }

  async waitForSuccess() {
    await this.page.waitForURL(/\/dashboard|\/onboarding/, { timeout: 10000 });
  }

  async waitForSuccessMessage() {
    await this.successMessage.waitFor({ state: 'visible', timeout: 5000 });
  }

  async waitForError() {
    await this.errorMessage.waitFor({ state: 'visible', timeout: 5000 });
  }

  async getErrorText(): Promise<string> {
    await this.errorMessage.waitFor({ state: 'visible', timeout: 5000 });
    return await this.errorMessage.textContent() || '';
  }

  async getSuccessText(): Promise<string> {
    await this.successMessage.waitFor({ state: 'visible', timeout: 5000 });
    return await this.successMessage.textContent() || '';
  }

  async isAcceptPage(): Promise<boolean> {
    return this.page.url().includes('/invites/verify-email');
  }

  async acceptInvitation(name: string, password: string) {
    await this.fillAcceptForm(name, password);
    await this.submit();
  }
}
