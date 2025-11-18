const DEFAULT_SITE_URL = "https://easy-work-ten.vercel.app/";

type NormalizedSiteUrl = {
  origin: string;
  isLocal: boolean;
};

const parseSiteUrl = (value?: string | null): NormalizedSiteUrl | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    const hostname = url.hostname.toLowerCase();
    const isLocal =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.endsWith(".local");

    return {
      origin: url.origin,
      isLocal,
    };
  } catch {
    return null;
  }
};

const resolvePreferredSiteUrl = () => {
  const allowLocalHost = process.env.NODE_ENV !== "production";
  let localFallback: string | null = null;

  const candidateEnvValues = [
    process.env.SITE_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_VERCEL_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  ];

  for (const candidate of candidateEnvValues) {
    const normalized = parseSiteUrl(candidate);
    if (!normalized) {
      continue;
    }

    if (!normalized.isLocal) {
      return normalized.origin;
    }

    if (allowLocalHost && !localFallback) {
      localFallback = normalized.origin;
    }
  }

  return localFallback;
};

export const getSiteBaseUrl = () => {
  const resolved = resolvePreferredSiteUrl();
  return resolved ?? DEFAULT_SITE_URL;
};

export const buildAbsoluteUrl = (path: string) => {
  const base = getSiteBaseUrl();
  if (!path) {
    return base;
  }

  return `${base}/${path.replace(/^\/+/, "")}`;
};

export const getEmailVerificationRedirectUrl = () => {
  return buildAbsoluteUrl("/auth/callback");
};
