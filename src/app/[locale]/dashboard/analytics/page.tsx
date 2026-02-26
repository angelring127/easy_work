"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResponsiveHeader } from "@/components/layout/responsive-header";
import { useAuth } from "@/contexts/auth-context";
import { useStore } from "@/contexts/store-context";
import { useAdminAccess } from "@/hooks/use-permissions";
import { WorkHoursAnalyticsPanel } from "@/components/dashboard/work-hours-analytics-panel";
import { t, type Locale } from "@/lib/i18n";
import { UserRole } from "@/types/auth";

export default function AnalyticsPage() {
  const { locale } = useParams();
  const currentLocale = locale as Locale;
  const router = useRouter();
  const { user } = useAuth();
  const { currentStore } = useStore();
  const { canViewAnalytics, isManager } = useAdminAccess();

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push(`/${locale}/login`);
    } catch (logoutError) {
      console.error("Logout error:", logoutError);
    }
  };

  return (
    <>
      <ResponsiveHeader
        userEmail={user?.email}
        currentStoreRole={user?.role as UserRole | undefined}
        locale={locale as string}
        onLogout={handleLogout}
      />

      <div className="container mx-auto p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex items-center gap-2 md:gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/${locale}/dashboard`)}
            className="flex items-center gap-2 min-h-[44px] touch-manipulation"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">{t("common.back", currentLocale)}</span>
          </Button>
          <div className="flex-1">
            <h1 className="text-xl md:text-3xl font-bold flex items-center gap-2">
              <BarChart3 className="h-5 w-5 md:h-7 md:w-7" />
              {t("analytics.title", currentLocale)}
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground">
              {currentStore?.name || t("schedule.noStoreSelected", currentLocale)}
            </p>
          </div>
        </div>

        <WorkHoursAnalyticsPanel
          locale={currentLocale}
          storeId={currentStore?.id}
          storeName={currentStore?.name}
          hasAnalyticsAccess={canViewAnalytics || isManager}
          showHeader={false}
        />
      </div>
    </>
  );
}
