import { defaultLocale, isValidLocale, type Locale } from "@/lib/i18n";
import type { NextRequest } from "next/server";

export function resolveRequestLocale(
  request: NextRequest,
  localeParam?: string
): Locale {
  if (localeParam && isValidLocale(localeParam)) {
    return localeParam;
  }

  const localeFromQuery = request.nextUrl.searchParams.get("locale");
  if (localeFromQuery && isValidLocale(localeFromQuery)) {
    return localeFromQuery;
  }

  const acceptLanguage = request.headers.get("accept-language");
  const preferredLocale = acceptLanguage?.split(",")[0]?.split("-")[0];
  if (preferredLocale && isValidLocale(preferredLocale)) {
    return preferredLocale;
  }

  return defaultLocale;
}
