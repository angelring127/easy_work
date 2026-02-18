import { Page, Locator } from '@playwright/test';

export class DashboardPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly createStoreButton: Locator;
  readonly storeList: Locator;
  readonly userMenu: Locator;
  readonly logoutButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.locator('h1, h2').first();
    this.createStoreButton = page.locator('button:has-text("Create"), button:has-text("추가"), a[href*="/stores/new"]');
    this.storeList = page.locator('[data-testid="store-list"], .store-card, .store-item');
    this.userMenu = page.locator('[data-testid="user-menu"], button[aria-label*="menu"]');
    this.logoutButton = page.locator('button:has-text("Logout"), button:has-text("로그아웃")');
  }

  async goto(locale: string = 'en') {
    await this.page.goto(`/${locale}/dashboard`);
    await this.page.waitForLoadState('networkidle');
  }

  async isDashboardPage(): Promise<boolean> {
    return this.page.url().includes('/dashboard');
  }

  async waitForLoad() {
    await this.page.waitForLoadState('networkidle');
    await this.heading.waitFor({ state: 'visible', timeout: 10000 });
  }

  async logout() {
    if (await this.userMenu.isVisible()) {
      await this.userMenu.click();
    }
    await this.logoutButton.click();
  }

  async getHeadingText(): Promise<string> {
    return await this.heading.textContent() || '';
  }
}
