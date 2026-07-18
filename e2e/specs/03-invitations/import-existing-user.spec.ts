import { test, expect } from '../../fixtures/store.fixture';
import { InvitationPage } from '../../pages/invitation.page';
import {
  addUserToStore,
  createTestStore,
  createTestUser,
  deleteTestUser,
  getAdminClient,
  getTestUserByEmail,
} from '../../utils/database';
import { deleteStoreViaDB } from '../../utils/api-helpers';
import { generatePassword, generateStoreCode, generateStoreName, generateUserName } from '../../utils/test-data-factory';

test.describe('Import Existing Users From Another Store', () => {
  const createdStoreIds: string[] = [];
  const createdUserEmails: string[] = [];

  test.afterEach(async () => {
    while (createdStoreIds.length > 0) {
      const storeId = createdStoreIds.pop();
      if (storeId) {
        await deleteStoreViaDB(storeId);
      }
    }

    while (createdUserEmails.length > 0) {
      const email = createdUserEmails.pop();
      if (email) {
        await deleteTestUser(email);
      }
    }
  });

  test('MASTER can import another-store user into current store without creating invitation', async ({
    masterPage,
    testStore,
  }) => {
    const invitationPage = new InvitationPage(masterPage);
    const adminClient = getAdminClient();
    const masterEmail =
      process.env.TEST_MASTER_EMAIL || 'test-master@workeasy.test';
    const masterUser = await getTestUserByEmail(masterEmail);

    if (!masterUser) {
      throw new Error(`Master user not found: ${masterEmail}`);
    }

    const sourceStore = await createTestStore(
      masterUser.id,
      `${generateStoreName()}-source`,
      generateStoreCode()
    );
    createdStoreIds.push(sourceStore.id);

    const importUserEmail = `import-user-${Date.now()}@workeasy.test`;
    const importUserPassword = generatePassword();
    const importUserName = generateUserName();
    const importUser = await createTestUser(importUserEmail, importUserPassword);
    createdUserEmails.push(importUserEmail);

    await addUserToStore(
      sourceStore.id,
      importUser.id,
      'PART_TIMER',
      masterUser.id,
      importUserName
    );

    await invitationPage.goto('en', testStore.id);
    await invitationPage.openInviteDialog();
    await invitationPage.switchToImportMode();
    await invitationPage.selectSourceStore(sourceStore.name);

    await expect
      .poll(async () => await invitationPage.hasImportCandidate(importUserName), {
        timeout: 10000,
      })
      .toBeTruthy();

    await invitationPage.selectImportCandidate(importUserName);
    await invitationPage.submitInvite();
    await invitationPage.waitForSuccess();

    const { data: targetRole, error: targetRoleError } = await adminClient
      .from('user_store_roles')
      .select('user_id, store_id, role, status')
      .eq('store_id', testStore.id)
      .eq('user_id', importUser.id)
      .eq('status', 'ACTIVE')
      .maybeSingle();

    expect(targetRoleError).toBeNull();
    expect(targetRole).not.toBeNull();
    expect(targetRole?.role).toBe('PART_TIMER');

    const { data: targetStoreUser, error: targetStoreUserError } = await adminClient
      .from('store_users')
      .select('id, user_id, store_id, is_guest, is_active')
      .eq('store_id', testStore.id)
      .eq('user_id', importUser.id)
      .eq('is_guest', false)
      .eq('is_active', true)
      .maybeSingle();

    expect(targetStoreUserError).toBeNull();
    expect(targetStoreUser).not.toBeNull();

    const { data: invitations, error: invitationsError } = await adminClient
      .from('invitations')
      .select('id')
      .eq('store_id', testStore.id)
      .eq('invited_email', importUserEmail);

    expect(invitationsError).toBeNull();
    expect(invitations || []).toHaveLength(0);
  });
});
