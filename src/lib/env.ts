const DEFAULT_SITE_URL = "http://localhost:3000";

const normalizeSiteUrl = (value?: string | null) => {
  if (!value) {
    return DEFAULT_SITE_URL;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return DEFAULT_SITE_URL;
  }

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  return withProtocol.replace(/\/+$/, "");
};

export const getSiteBaseUrl = () => {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    process.env.NEXT_PUBLIC_VERCEL_URL ??
    DEFAULT_SITE_URL;

  return normalizeSiteUrl(siteUrl);
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


