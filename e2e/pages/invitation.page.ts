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

export interface ImportInviteData {
  sourceStoreName: string;
  candidateName: string;
  role?: 'PART_TIMER' | 'SUB_MANAGER';
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
  readonly emailModeTab: Locator;
  readonly guestModeTab: Locator;
  readonly importModeTab: Locator;
  readonly invitationManagementTab: Locator;
  readonly submitButton: Locator;
  readonly cancelButton: Locator;
  readonly invitationTable: Locator;
  readonly statusBadges: Locator;
  readonly successToast: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.createInviteButton = page.locator(
      'button:has-text("초대 생성"), button:has-text("Create Invitation"), button:has-text("Create Invite")'
    );
    this.inviteDialog = page.locator('[role="dialog"]');
    this.emailInput = page.locator('[role="dialog"] input#email, [role="dialog"] input[type="email"]');
    this.nameInput = page.locator('[role="dialog"] input#name');
    this.roleSelect = page.locator('[role="dialog"] select, [role="dialog"] [role="combobox"]');
    this.expiresInDaysSelect = page.locator('[role="dialog"] select[name="expiresInDays"]');
    this.isGuestCheckbox = page.locator('[role="dialog"] input#isGuest, [role="dialog"] input[type="checkbox"]');
    this.emailModeTab = page.getByRole('tab', { name: /email invite|이메일 초대/i });
    this.guestModeTab = page.getByRole('tab', { name: /guest registration|게스트 등록/i });
    this.importModeTab = page.getByRole('tab', { name: /other store users|다른 지점 유저/i });
    this.invitationManagementTab = page.getByRole('tab', {
      name: /invitation management|초대 관리/i,
    });
    this.submitButton = page.locator(
      [
        '[role="dialog"] button:has-text("초대 생성")',
        '[role="dialog"] button:has-text("Create Invitation")',
        '[role="dialog"] button:has-text("Create Invite")',
        '[role="dialog"] button:has-text("현재 지점에 등록")',
        '[role="dialog"] button:has-text("Add to Current Store")',
        '[role="dialog"] button[type="submit"]',
      ].join(', ')
    );
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
    if (await this.invitationManagementTab.count()) {
      await this.invitationManagementTab.click();
      await this.page.waitForTimeout(500);
    }

    await this.createInviteButton.waitFor({ state: 'visible', timeout: 10000 });
    await this.createInviteButton.click();
    await this.inviteDialog.waitFor({ state: 'visible', timeout: 5000 });
    await this.page.waitForTimeout(500);
  }

  async fillEmailInvite(data: EmailInviteData) {
    if (await this.emailModeTab.count()) {
      await this.emailModeTab.click();
    }

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

  async fillImportInvite(data: ImportInviteData) {
    await this.switchToImportMode();
    await this.selectSourceStore(data.sourceStoreName);
    await this.selectImportCandidate(data.candidateName);

    if (data.role) {
      await this.fillRole(data.role);
    }
  }

  private async fillRole(role: 'PART_TIMER' | 'SUB_MANAGER') {
    const isNativeSelect = await this.page.locator('[role="dialog"] select').count() > 0;

    if (isNativeSelect) {
      await this.roleSelect.selectOption(role);
    } else {
      await this.roleSelect.click();
      const roleTexts =
        role === 'PART_TIMER'
          ? ['파트타이머', 'Part Timer', 'アルバイト', role]
          : ['서브 매니저', 'Sub Manager', 'サブ管理者', role];

      for (const roleText of roleTexts) {
        const option = this.page.getByRole('option', { name: roleText }).first();
        if (await option.count()) {
          await option.click();
          return;
        }
      }

      throw new Error(`Role option not found: ${role}`);
    }
  }

  async toggleGuestMode() {
    if (await this.guestModeTab.count()) {
      await this.guestModeTab.click();
    } else {
      await this.isGuestCheckbox.check();
    }
    await this.page.waitForTimeout(300);
  }

  async switchToImportMode() {
    await this.importModeTab.click();
    await this.page.waitForTimeout(300);
  }

  async selectSourceStore(storeName: string) {
    const tab = this.page
      .locator('[role="dialog"]')
      .getByRole('tab', { name: storeName })
      .first();
    await tab.click();
    await this.page.waitForTimeout(500);
  }

  async selectImportCandidate(candidateName: string) {
    const candidateLabel = this.page
      .locator('[role="dialog"] label')
      .filter({ hasText: candidateName })
      .first();
    await candidateLabel.evaluate((element) => {
      (element as HTMLElement).click();
    });
  }

  async hasImportCandidate(candidateName: string): Promise<boolean> {
    return await this.page
      .locator('[role="dialog"] label')
      .filter({ hasText: candidateName })
      .first()
      .isVisible()
      .catch(() => false);
  }

  async submitInvite() {
    await this.submitButton.evaluate((element) => {
      (element as HTMLElement).click();
    });
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
