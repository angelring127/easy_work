import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables for testing');
}

export const getAdminClient = () => {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

export const cleanupTestData = async (prefix: string) => {
  const adminClient = getAdminClient();

  const { data: users } = await adminClient.auth.admin.listUsers();
  const testUsers = users?.users.filter(u => u.email?.includes(prefix)) || [];

  for (const user of testUsers) {
    await adminClient.auth.admin.deleteUser(user.id);
  }

  await adminClient
    .from('stores')
    .delete()
    .ilike('name', `${prefix}%`);
};

export const createTestUser = async (email: string, password: string) => {
  const adminClient = getAdminClient();

  const { data: existingUser } = await adminClient.auth.admin.listUsers();
  const existing = existingUser?.users.find(u => u.email === email);

  if (existing) {
    console.log(`User ${email} already exists`);
    return existing;
  }

  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    throw new Error(`Failed to create user ${email}: ${error.message}`);
  }

  console.log(`User ${email} created successfully`);
  return data.user;
};

export const deleteTestUser = async (email: string) => {
  const adminClient = getAdminClient();

  const { data: users } = await adminClient.auth.admin.listUsers();
  const user = users?.users.find(u => u.email === email);

  if (user) {
    await adminClient.auth.admin.deleteUser(user.id);
    console.log(`User ${email} deleted`);
  }
};

export const getTestUserByEmail = async (email: string) => {
  const adminClient = getAdminClient();

  const { data: users } = await adminClient.auth.admin.listUsers();
  return users?.users.find(u => u.email === email);
};

export const addUserToStore = async (
  storeId: string,
  userId: string,
  role: 'MASTER' | 'SUB_MANAGER' | 'PART_TIMER',
  grantedBy: string,
  name?: string
) => {
  const adminClient = getAdminClient();

  const { error: roleError } = await adminClient
    .from('user_store_roles')
    .upsert(
      {
        store_id: storeId,
        user_id: userId,
        role,
        status: 'ACTIVE',
        is_default_store: false,
        granted_at: new Date().toISOString(),
        deleted_at: null,
      } as any,
      { onConflict: 'user_id,store_id' }
    );

  if (roleError) {
    throw new Error(`Failed to grant store role: ${roleError.message}`);
  }

  const { data: existingStoreUser } = await adminClient
    .from('store_users')
    .select('id')
    .eq('store_id', storeId)
    .eq('user_id', userId)
    .eq('is_guest', false)
    .maybeSingle();

  if (existingStoreUser?.id) {
    const { data: updatedStoreUser, error: updateStoreUserError } = await adminClient
      .from('store_users')
      .update({
        role,
        name: name ?? undefined,
        is_active: true,
      })
      .eq('id', existingStoreUser.id)
      .select('id, store_id, user_id, role, name')
      .single();

    if (updateStoreUserError) {
      throw new Error(`Failed to update store user: ${updateStoreUserError.message}`);
    }

    return updatedStoreUser;
  }

  const { data: storeUser, error: storeUserError } = await adminClient
    .from('store_users')
    .insert({
      store_id: storeId,
      user_id: userId,
      name: name ?? null,
      role,
      is_guest: false,
      is_active: true,
      granted_by: grantedBy,
      granted_at: new Date().toISOString(),
    })
    .select('id, store_id, user_id, role, name')
    .single();

  if (storeUserError || !storeUser) {
    throw new Error(`Failed to create store user: ${storeUserError?.message}`);
  }

  return storeUser;
};

export const createWorkItem = async (
  storeId: string,
  {
    name,
    startMin,
    endMin,
    unpaidBreakMin = 0,
    maxHeadcount = 1,
  }: {
    name: string;
    startMin: number;
    endMin: number;
    unpaidBreakMin?: number;
    maxHeadcount?: number;
  }
) => {
  const adminClient = getAdminClient();
  const { data, error } = await adminClient
    .from('work_items')
    .insert({
      store_id: storeId,
      name,
      start_min: startMin,
      end_min: endMin,
      unpaid_break_min: unpaidBreakMin,
      max_headcount: maxHeadcount,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(`Failed to create work item: ${error?.message}`);
  }

  return data;
};

export const createScheduleAssignment = async ({
  storeId,
  storeUserId,
  workItemId,
  date,
  startTime,
  endTime,
  createdBy,
  status = 'ASSIGNED',
}: {
  storeId: string;
  storeUserId: string;
  workItemId: string;
  date: string;
  startTime: string;
  endTime: string;
  createdBy: string;
  status?: 'ASSIGNED' | 'CONFIRMED' | 'CANCELLED';
}) => {
  const adminClient = getAdminClient();
  const { data, error } = await adminClient
    .from('schedule_assignments')
    .insert({
      store_id: storeId,
      user_id: storeUserId,
      work_item_id: workItemId,
      date,
      start_time: startTime,
      end_time: endTime,
      status,
      created_by: createdBy,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(`Failed to create schedule assignment: ${error?.message}`);
  }

  return data;
};

export const createTestStore = async (
  userId: string,
  storeName: string,
  storeCode: string
) => {
  const adminClient = getAdminClient();

  const { data: store, error: storeError } = await adminClient
    .from('stores')
    .insert({
      name: storeName,
      owner_id: userId,
    })
    .select()
    .single();

  if (storeError) {
    throw new Error(`Failed to create store: ${storeError.message}`);
  }

  console.log(`Store ${storeName} created successfully`);
  return store;
};

export const deleteTestStore = async (storeId: string) => {
  const adminClient = getAdminClient();

  await adminClient.from('user_store_roles').delete().eq('store_id', storeId);
  await adminClient.from('stores').delete().eq('id', storeId);

  console.log(`Store ${storeId} deleted`);
};
