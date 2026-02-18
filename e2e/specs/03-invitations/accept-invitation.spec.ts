import { test } from '../../fixtures/store.fixture';
import { expect } from '@playwright/test';
import { InvitationPage } from '../../pages/invitation.page';
import { InviteAcceptPage } from '../../pages/invite-accept.page';
import { generateInvitationEmail, generateUserName, TEST_PASSWORDS } from '../../utils/test-data-factory';
import { getInvitationTokenFromDB, deleteInvitationViaDB } from '../../utils/api-helpers';
import { getAdminClient, deleteTestUser } from '../../utils/database';

test.describe('Invitation Acceptance', () => {
  test('New user can accept invitation successfully', async ({ masterPage, testStore, page }) => {
    const invitationPage = new InvitationPage(masterPage);
    const inviteAcceptPage = new InviteAcceptPage(page);
    const inviteEmail = generateInvitationEmail();
    const userName = generateUserName();

    await invitationPage.goto('en', testStore.id);

    await invitationPage.openInviteDialog();
    await invitationPage.fillEmailInvite({
      email: inviteEmail,
      role: 'PART_TIMER',
    });
    await invitationPage.submitInvite();
    await invitationPage.waitForSuccess();

    await masterPage.waitForTimeout(1000);

    const token = await getInvitationTokenFromDB(inviteEmail);
    expect(token).not.toBeNull();

    if (!token) {
      throw new Error('Failed to get invitation token from database');
    }

    await inviteAcceptPage.goto(token);

    await inviteAcceptPage.acceptInvitation(userName, TEST_PASSWORDS.valid);

    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    expect(currentUrl).toMatch(/\/dashboard|\/onboarding|\/stores/);

    await deleteTestUser(inviteEmail);
  });

  test('Should show error for expired invitation', async ({ page }) => {
    const inviteAcceptPage = new InviteAcceptPage(page);

    const adminClient = getAdminClient();
    const { data: expiredInvitation } = await adminClient
      .from('invitations')
      .select('token_hash')
      .eq('status', 'EXPIRED')
      .limit(1)
      .single();

    if (expiredInvitation && expiredInvitation.token_hash) {
      await inviteAcceptPage.goto(expiredInvitation.token_hash);

      await inviteAcceptPage.fillAcceptForm('Test User', TEST_PASSWORDS.valid);
      await inviteAcceptPage.submit();

      await page.waitForTimeout(2000);

      const currentUrl = page.url();
      expect(currentUrl).toContain('/invites');
    } else {
      test.skip();
    }
  });

  test('Should show error for already accepted invitation', async ({ masterPage, testStore, page }) => {
    const invitationPage = new InvitationPage(masterPage);
    const inviteAcceptPage = new InviteAcceptPage(page);
    const inviteEmail = generateInvitationEmail();
    const userName = generateUserName();

    await invitationPage.goto('en', testStore.id);

    await invitationPage.openInviteDialog();
    await invitationPage.fillEmailInvite({
      email: inviteEmail,
      role: 'PART_TIMER',
    });
    await invitationPage.submitInvite();
    await invitationPage.waitForSuccess();

    await masterPage.waitForTimeout(1000);

    const token = await getInvitationTokenFromDB(inviteEmail);
    expect(token).not.toBeNull();

    if (!token) {
      throw new Error('Failed to get invitation token');
    }

    await inviteAcceptPage.goto(token);
    await inviteAcceptPage.acceptInvitation(userName, TEST_PASSWORDS.valid);

    await page.waitForTimeout(2000);

    await inviteAcceptPage.goto(token);
    await inviteAcceptPage.fillAcceptForm('Another User', TEST_PASSWORDS.valid);
    await inviteAcceptPage.submit();

    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    expect(currentUrl).toContain('/invites');

    await deleteTestUser(inviteEmail);
  });

  test('Should show validation error for weak password', async ({ masterPage, testStore, page }) => {
    const invitationPage = new InvitationPage(masterPage);
    const inviteAcceptPage = new InviteAcceptPage(page);
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

    const token = await getInvitationTokenFromDB(inviteEmail);
    expect(token).not.toBeNull();

    if (!token) {
      throw new Error('Failed to get invitation token');
    }

    await inviteAcceptPage.goto(token);

    await inviteAcceptPage.fillAcceptForm('Test User', TEST_PASSWORDS.weak);
    await inviteAcceptPage.submit();

    await page.waitForTimeout(1000);

    const isStillOnAcceptPage = await inviteAcceptPage.isAcceptPage();
    expect(isStillOnAcceptPage).toBeTruthy();

    const adminClient = getAdminClient();
    await adminClient.from('invitations').delete().eq('invited_email', inviteEmail);
  });
});
