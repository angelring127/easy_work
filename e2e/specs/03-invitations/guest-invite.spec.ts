import { test } from '../../fixtures/store.fixture';
import { expect } from '@playwright/test';
import { InvitationPage } from '../../pages/invitation.page';
import { generateGuestName } from '../../utils/test-data-factory';
import { getAdminClient } from '../../utils/database';

test.describe('Guest User Invitations', () => {
  test('Can create guest user without email', async ({ masterPage, testStore }) => {
    const invitationPage = new InvitationPage(masterPage);
    const guestName = generateGuestName();

    await invitationPage.goto('en', testStore.id);

    await invitationPage.openInviteDialog();

    await invitationPage.toggleGuestMode();

    await invitationPage.fillGuestInvite({
      name: guestName,
      role: 'PART_TIMER',
    });

    await invitationPage.submitInvite();

    await invitationPage.waitForSuccess();

    const successText = await invitationPage.getSuccessToastText();
    expect(successText).toContain('게스트' || 'guest' || 'success');

    await masterPage.waitForTimeout(2000);
  });

  test('Guest user should have is_guest flag in database', async ({ masterPage, testStore }) => {
    const invitationPage = new InvitationPage(masterPage);
    const guestName = generateGuestName();

    await invitationPage.goto('en', testStore.id);

    await invitationPage.openInviteDialog();
    await invitationPage.toggleGuestMode();
    await invitationPage.fillGuestInvite({
      name: guestName,
      role: 'PART_TIMER',
    });
    await invitationPage.submitInvite();
    await invitationPage.waitForSuccess();

    await masterPage.waitForTimeout(1000);

    const adminClient = getAdminClient();
    const { data: guestUser, error } = await adminClient
      .from('store_users')
      .select('*')
      .eq('store_id', testStore.id)
      .eq('name', guestName)
      .single();

    expect(error).toBeNull();
    expect(guestUser).not.toBeNull();
    expect(guestUser?.is_guest).toBe(true);
    expect(guestUser?.user_id).toBeNull();
  });

  test('Cannot create guest with duplicate name in same store', async ({ masterPage, testStore }) => {
    const invitationPage = new InvitationPage(masterPage);
    const guestName = generateGuestName();

    await invitationPage.goto('en', testStore.id);

    await invitationPage.openInviteDialog();
    await invitationPage.toggleGuestMode();
    await invitationPage.fillGuestInvite({
      name: guestName,
      role: 'PART_TIMER',
    });
    await invitationPage.submitInvite();
    await invitationPage.waitForSuccess();

    await masterPage.waitForTimeout(1000);

    await invitationPage.openInviteDialog();
    await invitationPage.toggleGuestMode();
    await invitationPage.fillGuestInvite({
      name: guestName,
      role: 'PART_TIMER',
    });
    await invitationPage.submitInvite();

    await masterPage.waitForTimeout(1000);

    const isDialogVisible = await invitationPage.inviteDialog.isVisible();
    expect(isDialogVisible).toBeTruthy();
  });
});
