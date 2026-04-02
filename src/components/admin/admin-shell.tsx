"use client";

import Link from "next/link";
import { useEffect } from "react";
import {
  AlertTriangle,
  LayoutDashboard,
  LogOut,
  ScrollText,
  ShieldCheck,
  Store,
  Users,
} from "lucide-react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { useAuth } from "@/contexts/auth-context";
import { canReadAdminConsole } from "@/lib/auth/platform-admin";
import {
  getAdminRoutePath,
  getAdminSectionFromPath,
  type AdminSectionKey,
} from "@/lib/admin/client";
import { t, type Locale } from "@/lib/i18n";
import { defaultLocale } from "@/lib/i18n-config";
import { cn } from "@/lib/utils";
import { AdminFilterBar } from "@/components/admin/admin-filter-bar";
import { AdminPill } from "@/components/admin/admin-ui";

const NAV_ITEMS: Array<{
  key: AdminSectionKey;
  icon: typeof LayoutDashboard;
}> = [
  { key: "overview", icon: LayoutDashboard },
  { key: "users", icon: Users },
  { key: "stores", icon: Store },
  { key: "anomalies", icon: AlertTriangle },
  { key: "logs", icon: ScrollText },
];

function AdminLoadingScreen({ locale }: { locale: Locale }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.18),_transparent_28%),linear-gradient(160deg,#020617_0%,#0f172a_50%,#111827_100%)] text-white">
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-cyan-400" />
          <p className="text-lg font-medium">{t("auth.login.loading", locale)}</p>
        </div>
      </div>
    </div>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const currentLocale = (params.locale as Locale) || defaultLocale;
  const { user, loading, signOut } = useAuth();

  const isLoginPage = pathname.endsWith("/admin/login");
  const activeSection = getAdminSectionFromPath(pathname);
  const hasAccess = canReadAdminConsole(user?.platform_admin_role);

  useEffect(() => {
    if (isLoginPage || loading) {
      return;
    }

    if (!user) {
      const redirectTo = pathname.replace(`/${currentLocale}`, "") || "/admin";
      router.replace(
        `/${currentLocale}/admin/login?redirectTo=${encodeURIComponent(redirectTo)}`
      );
      return;
    }

    if (!hasAccess) {
      router.replace(`/${currentLocale}/dashboard`);
    }
  }, [currentLocale, hasAccess, isLoginPage, loading, pathname, router, user]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (loading || !user || !hasAccess) {
    return <AdminLoadingScreen locale={currentLocale} />;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.16),_transparent_26%),linear-gradient(160deg,#020617_0%,#0f172a_52%,#111827_100%)] text-white">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-white/10 bg-slate-950/55 px-6 py-8 backdrop-blur lg:flex lg:flex-col">
        <div>
          <AdminPill tone="cyan" className="gap-2 px-4 py-2 text-sm">
            <ShieldCheck className="h-4 w-4" />
            {t("admin.console.badge", currentLocale)}
          </AdminPill>
          <div className="mt-6 space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              {t("admin.console.title", currentLocale)}
            </h1>
            <p className="text-sm leading-6 text-slate-400">
              {t("admin.console.description", currentLocale)}
            </p>
          </div>
        </div>

        <nav className="mt-10 space-y-2">
          {NAV_ITEMS.map(({ key, icon: Icon }) => {
            const isActive = activeSection === key;
            return (
              <Link
                key={key}
                href={getAdminRoutePath(currentLocale, key)}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition-colors",
                  isActive
                    ? "border-cyan-400/35 bg-cyan-400/10 text-cyan-100"
                    : "border-transparent bg-transparent text-slate-300 hover:border-white/10 hover:bg-white/5 hover:text-white"
                )}
              >
                <Icon className="h-4 w-4" />
                {t(`admin.tab.${key}`, currentLocale)}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              {t("admin.console.account", currentLocale)}
            </p>
            <p className="mt-3 break-all text-sm font-medium text-white">
              {user.email}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              {user.platform_admin_role || t("admin.role.none", currentLocale)}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <LanguageSwitcher
              triggerClassName="border-white/15 bg-slate-950/60 text-slate-100 hover:bg-slate-900 hover:text-white"
              contentClassName="border-white/15 bg-slate-950 text-slate-100"
              itemClassName="focus:bg-cyan-400/15 focus:text-cyan-100"
            />
            <Button
              type="button"
              variant="outline"
              className="flex-1 border-white/10 bg-slate-950/60 text-slate-200 hover:bg-slate-900 hover:text-white"
              onClick={() => signOut()}
            >
              <LogOut className="mr-2 h-4 w-4" />
              {t("dashboard.logout", currentLocale)}
            </Button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="border-b border-white/10 bg-slate-950/30 backdrop-blur">
          <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <AdminPill tone="slate" className="text-[11px] uppercase tracking-[0.2em]">
                  {t("admin.console.surfaceLabel", currentLocale)}
                </AdminPill>
                <div>
                  <p className="text-sm text-slate-400">
                    {t("admin.console.kicker", currentLocale)}
                  </p>
                  <h2 className="text-2xl font-semibold tracking-tight text-white">
                    {t(`admin.tab.${activeSection}`, currentLocale)}
                  </h2>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 lg:hidden">
                <LanguageSwitcher
                  triggerClassName="border-white/15 bg-slate-950/60 text-slate-100 hover:bg-slate-900 hover:text-white"
                  contentClassName="border-white/15 bg-slate-950 text-slate-100"
                  itemClassName="focus:bg-cyan-400/15 focus:text-cyan-100"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="border-white/10 bg-slate-950/60 text-slate-200 hover:bg-slate-900 hover:text-white"
                  onClick={() => signOut()}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  {t("dashboard.logout", currentLocale)}
                </Button>
              </div>
            </div>

            <nav className="mt-5 flex gap-2 overflow-x-auto pb-1 lg:hidden">
              {NAV_ITEMS.map(({ key, icon: Icon }) => {
                const isActive = activeSection === key;
                return (
                  <Link
                    key={key}
                    href={getAdminRoutePath(currentLocale, key)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm whitespace-nowrap transition-colors",
                      isActive
                        ? "border-cyan-400/35 bg-cyan-400/10 text-cyan-100"
                        : "border-white/10 bg-white/5 text-slate-300 hover:border-white/15 hover:text-white"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {t(`admin.tab.${key}`, currentLocale)}
                  </Link>
                );
              })}
            </nav>
          </div>
        </header>

        <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
          <AdminFilterBar />
          {children}
        </div>
      </div>
    </div>
  );
}
