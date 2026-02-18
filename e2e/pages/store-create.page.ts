import { Page, Locator } from '@playwright/test';

export interface StoreData {
  name: string;
  description?: string;
  address?: string;
  phone?: string;
  timezone?: string;
}

export class StoreCreatePage {
  readonly page: Page;
  readonly nameInput: Locator;
  readonly descriptionTextarea: Locator;
  readonly addressInput: Locator;
  readonly phoneInput: Locator;
  readonly timezoneSelect: Locator;
  readonly createButton: Locator;
  readonly cancelButton: Locator;
  readonly backButton: Locator;
  readonly errorMessage: Locator;
  readonly successToast: Locator;

  constructor(page: Page) {
    this.page = page;
    this.nameInput = page.locator('input#name');
    this.descriptionTextarea = page.locator('textarea#description');
    this.addressInput = page.locator('input#address');
    this.phoneInput = page.locator('input#phone');
    this.timezoneSelect = page.locator('select#timezone, [role="combobox"]');
    this.createButton = page.locator('button:has-text("매장 생성"), button[type="submit"]');
    this.cancelButton = page.locator('button:has-text("취소")');
    this.backButton = page.locator('button:has-text("뒤로")');
    this.errorMessage = page.locator('[role="alert"], .text-red-500, .text-destructive');
    this.successToast = page.locator('[role="status"], .toast, [data-sonner-toast]');
  }

  async goto(locale: string = 'en') {
    await this.page.goto(`/${locale}/stores/create`);
    await this.page.waitForLoadState('networkidle');
  }

  async fillStoreForm(data: StoreData) {
    if (data.name) {
      await this.nameInput.fill(data.name);
    }

    if (data.description) {
      await this.descriptionTextarea.fill(data.description);
    }

    if (data.address) {
      await this.addressInput.fill(data.address);
    }

    if (data.phone) {
      await this.phoneInput.fill(data.phone);
    }

    if (data.timezone) {
      const isNativeSelect = await this.page.locator('select#timezone').count() > 0;

      if (isNativeSelect) {
        await this.page.selectOption('select#timezone', data.timezone);
      } else {
        await this.timezoneSelect.click();
        await this.page.locator(`[role="option"]:has-text("${data.timezone}")`).click();
      }
    }
  }

  async clickCreate() {
    await this.createButton.click();
  }

  async waitForSuccess() {
    await this.page.waitForURL(/\/stores$/, { timeout: 10000 });
  }

  async waitForSuccessToast() {
    await this.successToast.waitFor({ state: 'visible', timeout: 5000 });
  }

  async getSuccessToastText(): Promise<string> {
    await this.successToast.waitFor({ state: 'visible', timeout: 5000 });
    return await this.successToast.textContent() || '';
  }

  async waitForError() {
    await this.errorMessage.waitFor({ state: 'visible', timeout: 5000 });
  }

  async getErrorText(): Promise<string> {
    await this.errorMessage.waitFor({ state: 'visible', timeout: 5000 });
    return await this.errorMessage.textContent() || '';
  }

  async isCreatePage(): Promise<boolean> {
    return this.page.url().includes('/stores/create');
  }

  async hasNameInput(): Promise<boolean> {
    return await this.nameInput.isVisible();
  }

  async submitFormWithData(data: StoreData) {
    await this.fillStoreForm(data);
    await this.clickCreate();
  }
}
