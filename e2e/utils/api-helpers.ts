import { StoreData } from '../pages/store-create.page';
import { getAdminClient } from './database';

export interface CreateStoreResponse {
  success: boolean;
  data?: {
    id: string;
    name: string;
    description?: string;
    address?: string;
    phone?: string;
    timezone: string;
    owner_id: string;
    status: string;
    user_role: string;
    granted_at: string;
    created_at: string;
    updated_at: string;
  };
  error?: string;
  message?: string;
}

export interface GetInvitationsResponse {
  success: boolean;
  data?: {
    invitations: Array<{
      id: string;
      store_id: string;
      invited_email: string;
      role_hint: 'PART_TIMER' | 'SUB_MANAGER';
      token_hash: string;
      status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED';
      created_at: string;
      expires_at: string;
      invited_by: string;
      accepted_at?: string;
      accepted_by?: string;
    }>;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
  error?: string;
}

export async function createStoreViaAPI(
  authToken: string,
  storeData: StoreData
): Promise<CreateStoreResponse> {
  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/stores`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(storeData),
  });

  return await response.json();
}

export async function getInvitationsViaAPI(
  authToken: string,
  storeId: string,
  filters?: {
    status?: string;
    page?: number;
    limit?: number;
  }
): Promise<GetInvitationsResponse> {
  const params = new URLSearchParams({
    storeId,
    ...(filters?.status && { status: filters.status }),
    ...(filters?.page && { page: filters.page.toString() }),
    ...(filters?.limit && { limit: filters.limit.toString() }),
  });

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/invitations?${params}`,
    {
      headers: { Authorization: `Bearer ${authToken}` },
    }
  );

  return await response.json();
}

export async function createInvitationViaAPI(
  authToken: string,
  invitationData: {
    email?: string;
    name?: string;
    storeId: string;
    roleHint: 'PART_TIMER' | 'SUB_MANAGER';
    expiresInDays?: number;
    isGuest?: boolean;
  }
) {
  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/invitations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(invitationData),
  });

  return await response.json();
}

export async function deleteStoreViaDB(storeId: string): Promise<void> {
  const adminClient = getAdminClient();

  await adminClient.from('user_store_roles').delete().eq('store_id', storeId);

  await adminClient.from('store_users').delete().eq('store_id', storeId);

  await adminClient.from('invitations').delete().eq('store_id', storeId);

  await adminClient.from('stores').delete().eq('id', storeId);

  console.log(`Store ${storeId} and related data deleted`);
}

export async function deleteInvitationViaDB(invitationId: string): Promise<void> {
  const adminClient = getAdminClient();

  await adminClient.from('invitations').delete().eq('id', invitationId);

  console.log(`Invitation ${invitationId} deleted`);
}

export async function getInvitationTokenFromDB(invitationEmail: string): Promise<string | null> {
  const adminClient = getAdminClient();

  const { data, error } = await adminClient
    .from('invitations')
    .select('token_hash')
    .eq('invited_email', invitationEmail)
    .eq('status', 'PENDING')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    console.error(`Failed to get invitation token for ${invitationEmail}:`, error);
    return null;
  }

  return data.token_hash;
}

export async function getStoreIdByNameFromDB(storeName: string): Promise<string | null> {
  const adminClient = getAdminClient();

  const { data, error } = await adminClient
    .from('stores')
    .select('id')
    .eq('name', storeName)
    .single();

  if (error || !data) {
    console.error(`Failed to get store ID for ${storeName}:`, error);
    return null;
  }

  return data.id;
}

export async function cleanupTestStores(): Promise<void> {
  const adminClient = getAdminClient();

  const { data: stores } = await adminClient
    .from('stores')
    .select('id')
    .ilike('name', 'test-store-%');

  if (stores && stores.length > 0) {
    for (const store of stores) {
      await deleteStoreViaDB(store.id);
    }
    console.log(`Cleaned up ${stores.length} test stores`);
  }
}

export async function cleanupTestInvitations(): Promise<void> {
  const adminClient = getAdminClient();

  await adminClient.from('invitations').delete().ilike('invited_email', 'test-invite-%');

  console.log('Cleaned up test invitations');
}
