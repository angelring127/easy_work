import { Page, Locator } from '@playwright/test';

export class StoreListPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly createStoreButton: Locator;
  readonly storeCards: Locator;
  readonly viewButtons: Locator;
  readonly editButtons: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.locator('h1, h2').first();
    this.createStoreButton = page.locator(
      'button:has-text("매장 생성"), button:has-text("Create"), a[href*="/stores/create"]'
    );
    this.storeCards = page.locator('[data-testid="store-card"], .store-card, [data-store-id]');
    this.viewButtons = page.locator('button:has-text("보기"), button:has-text("View"), a:has-text("보기")');
    this.editButtons = page.locator('button:has-text("수정"), button:has-text("Edit"), a:has-text("수정")');
  }

  async goto(locale: string = 'en') {
    await this.page.goto(`/${locale}/stores`);
    await this.page.waitForLoadState('networkidle');
  }

  async waitForLoad() {
    await this.page.waitForLoadState('networkidle');
    await this.heading.waitFor({ state: 'visible', timeout: 10000 });
  }

  async clickCreateStore() {
    await this.createStoreButton.click();
    await this.page.waitForURL(/\/stores\/create/, { timeout: 5000 });
  }

  async getStoreCount(): Promise<number> {
    await this.page.waitForTimeout(1000);
    return await this.storeCards.count();
  }

  async findStoreByName(name: string): Promise<Locator | null> {
    const cards = await this.storeCards.all();

    for (const card of cards) {
      const text = await card.textContent();
      if (text?.includes(name)) {
        return card;
      }
    }

    return null;
  }

  async clickViewStore(storeName: string) {
    const storeCard = await this.findStoreByName(storeName);

    if (!storeCard) {
      throw new Error(`Store with name "${storeName}" not found`);
    }

    const viewButton = storeCard.locator('button:has-text("보기"), button:has-text("View"), a:has-text("보기")').first();
    await viewButton.click();
  }

  async hasCreateButton(): Promise<boolean> {
    try {
      await this.createStoreButton.waitFor({ state: 'visible', timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }

  async getHeadingText(): Promise<string> {
    return await this.heading.textContent() || '';
  }

  async hasStoreWithName(name: string): Promise<boolean> {
    const store = await this.findStoreByName(name);
    return store !== null;
  }

  async getStoreNames(): Promise<string[]> {
    const cards = await this.storeCards.all();
    const names: string[] = [];

    for (const card of cards) {
      const text = await card.textContent();
      if (text) {
        names.push(text.trim());
      }
    }

    return names;
  }
}
