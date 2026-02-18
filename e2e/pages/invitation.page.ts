import { Page, Locator } from '@playwright/test';

export interface EmailInviteData {
  email: string;
  name?: string;
  role: 'PART_TIMER' | 'SUB_MANAGER';
  expiresInDays?: number;
}

export interface GuestInviteData {
  name: string;
  role: 'PART_TIMER' | 'SUB_MANAGER';
}

export class InvitationPage {
  readonly page: Page;
  readonly createInviteButton: Locator;
  readonly inviteDialog: Locator;
  readonly emailInput: Locator;
  readonly nameInput: Locator;
  readonly roleSelect: Locator;
  readonly expiresInDaysSelect: Locator;
  readonly isGuestCheckbox: Locator;
  readonly submitButton: Locator;
  readonly cancelButton: Locator;
  readonly invitationTable: Locator;
  readonly statusBadges: Locator;
  readonly successToast: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.createInviteButton = page.locator('button:has-text("초대 생성"), button:has-text("Create Invite")');
    this.inviteDialog = page.locator('[role="dialog"]');
    this.emailInput = page.locator('[role="dialog"] input#email, [role="dialog"] input[type="email"]');
    this.nameInput = page.locator('[role="dialog"] input#name');
    this.roleSelect = page.locator('[role="dialog"] select, [role="dialog"] [role="combobox"]');
    this.expiresInDaysSelect = page.locator('[role="dialog"] select[name="expiresInDays"]');
    this.isGuestCheckbox = page.locator('[role="dialog"] input#isGuest, [role="dialog"] input[type="checkbox"]');
    this.submitButton = page.locator('[role="dialog"] button:has-text("초대 생성"), [role="dialog"] button[type="submit"]');
    this.cancelButton = page.locator('[role="dialog"] button:has-text("취소"), [role="dialog"] button:has-text("Cancel")');
    this.invitationTable = page.locator('table');
    this.statusBadges = page.locator('[data-status], .badge');
    this.successToast = page.locator('[role="status"], .toast, [data-sonner-toast]');
    this.errorMessage = page.locator('[role="alert"], .text-red-500, .text-destructive');
  }

  async goto(locale: string, storeId: string) {
    await this.page.goto(`/${locale}/stores/${storeId}/users`);
    await this.page.waitForLoadState('networkidle');
  }

  async openInviteDialog() {
    await this.createInviteButton.click();
    await this.inviteDialog.waitFor({ state: 'visible', timeout: 5000 });
    await this.page.waitForTimeout(500);
  }

  async fillEmailInvite(data: EmailInviteData) {
    await this.emailInput.fill(data.email);

    if (data.name) {
      await this.nameInput.fill(data.name);
    }

    await this.fillRole(data.role);

    if (data.expiresInDays !== undefined) {
      const isNativeSelect = await this.page.locator('[role="dialog"] select[name="expiresInDays"]').count() > 0;

      if (isNativeSelect) {
        await this.expiresInDaysSelect.selectOption(data.expiresInDays.toString());
      } else {
        await this.expiresInDaysSelect.click();
        await this.page.locator(`[role="option"]:has-text("${data.expiresInDays}")`).click();
      }
    }
  }

  async fillGuestInvite(data: GuestInviteData) {
    await this.nameInput.fill(data.name);
    await this.fillRole(data.role);
  }

  private async fillRole(role: 'PART_TIMER' | 'SUB_MANAGER') {
    const isNativeSelect = await this.page.locator('[role="dialog"] select').count() > 0;

    if (isNativeSelect) {
      await this.roleSelect.selectOption(role);
    } else {
      await this.roleSelect.click();
      const roleText = role === 'PART_TIMER' ? '파트타이머' : '서브 매니저';
      await this.page.locator(`[role="option"]:has-text("${roleText}"), [role="option"]:has-text("${role}")`).first().click();
    }
  }

  async toggleGuestMode() {
    await this.isGuestCheckbox.check();
    await this.page.waitForTimeout(300);
  }

  async submitInvite() {
    await this.submitButton.click();
  }

  async waitForSuccess() {
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
    return await this.errorMessage.textContent() || '';
  }

  async getInvitationCount(): Promise<number> {
    await this.page.waitForTimeout(1000);
    const rows = this.invitationTable.locator('tbody tr');
    return await rows.count();
  }

  async findInvitationByEmail(email: string): Promise<Locator | null> {
    const rows = await this.invitationTable.locator('tbody tr').all();

    for (const row of rows) {
      const text = await row.textContent();
      if (text?.includes(email)) {
        return row;
      }
    }

    return null;
  }

  async resendInvitation(email: string) {
    const invitationRow = await this.findInvitationByEmail(email);

    if (!invitationRow) {
      throw new Error(`Invitation for "${email}" not found`);
    }

    const resendButton = invitationRow.locator('button:has-text("재발송"), button:has-text("Resend")');
    await resendButton.click();
  }

  async cancelInvitation(email: string) {
    const invitationRow = await this.findInvitationByEmail(email);

    if (!invitationRow) {
      throw new Error(`Invitation for "${email}" not found`);
    }

    const cancelButton = invitationRow.locator('button:has-text("취소"), button:has-text("Cancel")');
    await cancelButton.click();
  }

  async getInvitationStatus(email: string): Promise<string> {
    const invitationRow = await this.findInvitationByEmail(email);

    if (!invitationRow) {
      throw new Error(`Invitation for "${email}" not found`);
    }

    const statusBadge = invitationRow.locator('[data-status], .badge').first();
    return await statusBadge.textContent() || '';
  }

  async hasInvitationWithEmail(email: string): Promise<boolean> {
    const invitation = await this.findInvitationByEmail(email);
    return invitation !== null;
  }

  async closeDialog() {
    await this.cancelButton.click();
    await this.inviteDialog.waitFor({ state: 'hidden', timeout: 3000 });
  }

  async hasCreateInviteButton(): Promise<boolean> {
    try {
      await this.createInviteButton.waitFor({ state: 'visible', timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }
}
