import { existsSync } from "node:fs";
import * as dotenv from "dotenv";
import { createClient, type User } from "@supabase/supabase-js";
import { PlatformAdminRole, UserRole } from "../src/types/auth";

const DEFAULT_ENV_FILES = [".env.local", ".env"];
const DEFAULT_ADMIN_NAME = "System Admin";
const DEFAULT_PLATFORM_ROLE = PlatformAdminRole.SYSTEM_ADMIN;
const DEFAULT_USER_ROLE = UserRole.MASTER;

function loadEnvironment() {
  const explicitEnvFile = process.env.ADMIN_ENV_FILE;
  const envFiles = explicitEnvFile
    ? [explicitEnvFile, ...DEFAULT_ENV_FILES]
    : DEFAULT_ENV_FILES;

  for (const envFile of envFiles) {
    if (!existsSync(envFile)) {
      continue;
    }

    dotenv.config({ path: envFile, override: false });
  }
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function parsePlatformAdminRole(value: string | undefined): PlatformAdminRole {
  if (!value) {
    return DEFAULT_PLATFORM_ROLE;
  }

  if (
    Object.values(PlatformAdminRole).includes(value as PlatformAdminRole)
  ) {
    return value as PlatformAdminRole;
  }

  throw new Error(
    `Invalid ADMIN_PLATFORM_ROLE: ${value}. Expected one of ${Object.values(
      PlatformAdminRole
    ).join(", ")}`
  );
}

function parseUserRole(value: string | undefined): UserRole {
  if (!value) {
    return DEFAULT_USER_ROLE;
  }

  if (Object.values(UserRole).includes(value as UserRole)) {
    return value as UserRole;
  }

  throw new Error(
    `Invalid ADMIN_USER_ROLE: ${value}. Expected one of ${Object.values(
      UserRole
    ).join(", ")}`
  );
}

async function listAllUsers() {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const users: User[] = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw new Error(`Failed to list users: ${error.message}`);
    }

    const batch = data.users || [];
    users.push(...batch);

    if (batch.length < perPage) {
      return { adminClient, users };
    }

    page += 1;
  }
}

async function provisionAdmin() {
  loadEnvironment();

  const adminEmail = requireEnv("ADMIN_EMAIL");
  const adminPassword = requireEnv("ADMIN_PASSWORD");
  const adminName = process.env.ADMIN_NAME?.trim() || DEFAULT_ADMIN_NAME;
  const platformAdminRole = parsePlatformAdminRole(
    process.env.ADMIN_PLATFORM_ROLE?.trim()
  );
  const userRole = parseUserRole(process.env.ADMIN_USER_ROLE?.trim());

  const { adminClient, users } = await listAllUsers();
  const existingUser = users.find(
    user => user.email?.toLowerCase() === adminEmail.toLowerCase()
  );

  const userMetadata = {
    ...(existingUser?.user_metadata || {}),
    name: adminName,
    role: userRole,
    platform_admin_role: platformAdminRole,
  };

  if (existingUser) {
    const { data, error } = await adminClient.auth.admin.updateUserById(
      existingUser.id,
      {
        password: adminPassword,
        email_confirm: true,
        user_metadata: userMetadata,
      }
    );

    if (error) {
      throw new Error(`Failed to update admin user: ${error.message}`);
    }

    console.log("Admin user updated successfully");
    console.log(`- email: ${data.user.email}`);
    console.log(`- id: ${data.user.id}`);
    console.log(`- role: ${userRole}`);
    console.log(`- platform_admin_role: ${platformAdminRole}`);
    return;
  }

  const { data, error } = await adminClient.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
    user_metadata: userMetadata,
  });

  if (error) {
    throw new Error(`Failed to create admin user: ${error.message}`);
  }

  console.log("Admin user created successfully");
  console.log(`- email: ${data.user.email}`);
  console.log(`- id: ${data.user.id}`);
  console.log(`- role: ${userRole}`);
  console.log(`- platform_admin_role: ${platformAdminRole}`);
}

provisionAdmin().catch(error => {
  console.error("Admin provisioning failed");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
