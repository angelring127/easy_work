export const GUEST_IDENTITY_PREFIX = "guest-name:";

export function normalizeGuestName(name?: string | null): string | null {
  if (!name) {
    return null;
  }

  const normalized = name.trim().replace(/\s+/g, " ");
  return normalized ? normalized.toLocaleLowerCase() : null;
}

export function buildCrossStoreIdentityKey({
  authUserId,
  isGuest,
  name,
}: {
  authUserId?: string | null;
  isGuest?: boolean;
  name?: string | null;
}): string | null {
  if (authUserId) {
    return authUserId;
  }

  if (!isGuest) {
    return null;
  }

  const normalizedGuestName = normalizeGuestName(name);
  return normalizedGuestName
    ? `${GUEST_IDENTITY_PREFIX}${normalizedGuestName}`
    : null;
}
