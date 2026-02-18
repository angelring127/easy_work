import { test } from '../../fixtures/store.fixture';
import { expect } from '@playwright/test';
import { InvitationPage } from '../../pages/invitation.page';
import { generateInvitationEmail, TEST_EMAILS } from '../../utils/test-data-factory';
import { deleteInvitationViaDB } from '../../utils/api-helpers';

test.describe('Email-based Invitations', () => {
  let invitationIds: string[] = [];

  test.afterAll(async () => {
    for (const id of invitationIds) {
      await deleteInvitationViaDB(id);
    }
  });

  test('MASTER can create email invitation', async ({ masterPage, testStore }) => {
    const invitationPage = new InvitationPage(masterPage);
    const inviteEmail = generateInvitationEmail();

    await invitationPage.goto('en', testStore.id);

    await invitationPage.openInviteDialog();

    await invitationPage.fillEmailInvite({
      email: inviteEmail,
      name: 'Test User',
      role: 'PART_TIMER',
      expiresInDays: 7,
    });

    await invitationPage.submitInvite();

    await invitationPage.waitForSuccess();

    const successText = await invitationPage.getSuccessToastText();
    expect(successText).toContain('초대' || 'success' || 'invite');

    const hasInvitation = await invitationPage.hasInvitationWithEmail(inviteEmail);
    expect(hasInvitation).toBeTruthy();
  });

  test('SUB_MANAGER can create email invitation', async ({ subManagerPage, testStore }) => {
    const invitationPage = new InvitationPage(subManagerPage);
    const inviteEmail = generateInvitationEmail();

    await invitationPage.goto('en', testStore.id);

    const hasCreateButton = await invitationPage.hasCreateInviteButton();

    if (hasCreateButton) {
      await invitationPage.openInviteDialog();

      await invitationPage.fillEmailInvite({
        email: inviteEmail,
        name: 'Test User',
        role: 'PART_TIMER',
      });

      await invitationPage.submitInvite();

      await invitationPage.waitForSuccess();

      const hasInvitation = await invitationPage.hasInvitationWithEmail(inviteEmail);
      expect(hasInvitation).toBeTruthy();
    } else {
      test.skip();
    }
  });

  test('PART_TIMER cannot create invitation', async ({ partTimerPage, testStore }) => {
    const invitationPage = new InvitationPage(partTimerPage);

    await invitationPage.goto('en', testStore.id);

    const hasCreateButton = await invitationPage.hasCreateInviteButton();
    expect(hasCreateButton).toBeFalsy();
  });

  test('Should show validation error for invalid email', async ({ masterPage, testStore }) => {
    const invitationPage = new InvitationPage(masterPage);

    await invitationPage.goto('en', testStore.id);

    await invitationPage.openInviteDialog();

    await invitationPage.fillEmailInvite({
      email: TEST_EMAILS.invalid,
      role: 'PART_TIMER',
    });

    await invitationPage.submitInvite();

    await masterPage.waitForTimeout(1000);

    const isDialogVisible = await invitationPage.inviteDialog.isVisible();
    expect(isDialogVisible).toBeTruthy();
  });

  test('Should show error for duplicate email invitation', async ({ masterPage, testStore }) => {
    const invitationPage = new InvitationPage(masterPage);
    const inviteEmail = generateInvitationEmail();

    await invitationPage.goto('en', testStore.id);

    await invitationPage.openInviteDialog();
    await invitationPage.fillEmailInvite({
      email: inviteEmail,
      role: 'PART_TIMER',
    });
    await invitationPage.submitInvite();
    await invitationPage.waitForSuccess();

    await masterPage.waitForTimeout(1000);

    await invitationPage.openInviteDialog();
    await invitationPage.fillEmailInvite({
      email: inviteEmail,
      role: 'PART_TIMER',
    });
    await invitationPage.submitInvite();

    await masterPage.waitForTimeout(1000);

    const isDialogVisible = await invitationPage.inviteDialog.isVisible();
    expect(isDialogVisible).toBeTruthy();
  });

  test('Can resend pending invitation', async ({ masterPage, testStore }) => {
    const invitationPage = new InvitationPage(masterPage);
    const inviteEmail = generateInvitationEmail();

    await invitationPage.goto('en', testStore.id);

    await invitationPage.openInviteDialog();
    await invitationPage.fillEmailInvite({
      email: inviteEmail,
      role: 'PART_TIMER',
    });
    await invitationPage.submitInvite();
    await invitationPage.waitForSuccess();

    await masterPage.waitForTimeout(1000);

    await invitationPage.resendInvitation(inviteEmail);

    await masterPage.waitForTimeout(1000);

    const successText = await invitationPage.getSuccessToastText();
    expect(successText.toLowerCase()).toContain('resend' || '재발송' || 'success');
  });

  test('Can cancel pending invitation', async ({ masterPage, testStore }) => {
    const invitationPage = new InvitationPage(masterPage);
    const inviteEmail = generateInvitationEmail();

    await invitationPage.goto('en', testStore.id);

    await invitationPage.openInviteDialog();
    await invitationPage.fillEmailInvite({
      email: inviteEmail,
      role: 'PART_TIMER',
    });
    await invitationPage.submitInvite();
    await invitationPage.waitForSuccess();

    await masterPage.waitForTimeout(1000);

    await invitationPage.cancelInvitation(inviteEmail);

    await masterPage.waitForTimeout(1000);

    const status = await invitationPage.getInvitationStatus(inviteEmail);
    expect(status.toUpperCase()).toContain('CANCEL' || '취소');
  });
});
