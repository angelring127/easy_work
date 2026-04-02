import { PlatformAdminRole } from "@/types/auth";

export const PLATFORM_ADMIN_READ_ROLES: PlatformAdminRole[] = [
  PlatformAdminRole.SYSTEM_ADMIN,
  PlatformAdminRole.OPS_ANALYST,
  PlatformAdminRole.SUPPORT_AGENT,
  PlatformAdminRole.READ_ONLY_AUDITOR,
];

export const PLATFORM_ADMIN_WRITE_ROLES: PlatformAdminRole[] = [
  PlatformAdminRole.SYSTEM_ADMIN,
  PlatformAdminRole.OPS_ANALYST,
];

export function isPlatformAdminRole(
  value: unknown
): value is PlatformAdminRole {
  if (typeof value !== "string") {
    return false;
  }

  return Object.values(PlatformAdminRole).includes(
    value as PlatformAdminRole
  );
}

export function extractPlatformAdminRole(
  metadata: Record<string, unknown> | null | undefined
): PlatformAdminRole | null {
  const rawRole = metadata?.platform_admin_role;
  if (!isPlatformAdminRole(rawRole)) {
    return null;
  }

  return rawRole;
}

export function canReadAdminConsole(
  role: PlatformAdminRole | null | undefined
): boolean {
  return !!role && PLATFORM_ADMIN_READ_ROLES.includes(role);
}

export function canWriteAdminConsole(
  role: PlatformAdminRole | null | undefined
): boolean {
  return !!role && PLATFORM_ADMIN_WRITE_ROLES.includes(role);
}
