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
