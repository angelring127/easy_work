import { type Locale } from "@/lib/i18n";

export const ADMIN_PERIOD_OPTIONS = ["today", "7d", "30d"] as const;

export type AdminPeriodOption = (typeof ADMIN_PERIOD_OPTIONS)[number];
export type AdminSectionKey =
  | "overview"
  | "users"
  | "stores"
  | "anomalies"
  | "logs";

export const ADMIN_EXPORT_RESOURCE_BY_SECTION: Record<AdminSectionKey, string> = {
  overview: "overview",
  users: "users",
  stores: "stores",
  anomalies: "anomalies",
  logs: "audit-logs",
};

export function getAdminSectionFromPath(pathname: string): AdminSectionKey {
  if (pathname.includes("/admin/users")) {
    return "users";
  }

  if (pathname.includes("/admin/stores")) {
    return "stores";
  }

  if (pathname.includes("/admin/anomalies")) {
    return "anomalies";
  }

  if (pathname.includes("/admin/logs")) {
    return "logs";
  }

  return "overview";
}

export function getAdminExportResource(pathname: string): string {
  return ADMIN_EXPORT_RESOURCE_BY_SECTION[getAdminSectionFromPath(pathname)];
}

export function getAdminRoutePath(
  locale: string,
  section: AdminSectionKey
): string {
  if (section === "overview") {
    return `/${locale}/admin`;
  }

  return `/${locale}/admin/${section}`;
}

export function formatAdminDate(
  value: string | null | undefined,
  locale: Locale
): string {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatAdminDateTime(
  value: string | null | undefined,
  locale: Locale
): string {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function parsePositiveInt(
  value: string | null | undefined,
  fallback = 1
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.floor(parsed);
}

export async function fetchAdminJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const result = await response.json();

  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.error || "FAILED_TO_FETCH_ADMIN_DATA");
  }

  return result.data as T;
}
