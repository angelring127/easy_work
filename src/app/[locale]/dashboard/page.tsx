"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useStore } from "@/contexts/store-context";
import { usePermissions, useAdminAccess } from "@/hooks/use-permissions";
import { MasterOnly } from "@/components/auth/permission-guard";
import { UserRole } from "@/types/auth";
import { ResponsiveHeader } from "@/components/layout/responsive-header";
import { WorkHoursAnalyticsPanel } from "@/components/dashboard/work-hours-analytics-panel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BarChart3,
  Calendar,
  Loader2,
  MessageSquare,
  Settings,
  Store,
  UserPlus,
} from "lucide-react";
import { t, type Locale } from "@/lib/i18n";
import { defaultLocale } from "@/lib/i18n-config";

export default function DashboardPage() {
  const { locale } = useParams();
  const { user, loading, signOut } = useAuth();
  const {
    currentStore,
    accessibleStores,
    isLoading: storesLoading,
  } = useStore();
  const router = useRouter();
  const currentLocale = (locale as Locale) || defaultLocale;
  const [showNoStoreModal, setShowNoStoreModal] = useState(false);

  const { userRole } = usePermissions();
  const {
    canManageStore,
    canManageUsers,
    canApproveShifts,
    canViewAnalytics,
    isManager,
  } = useAdminAccess();

  useEffect(() => {
    if (!loading && user) {
      const refreshStores = async () => {
        try {
          const response = await fetch("/api/stores?mine=1", {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          });

          if (response.ok) {
            const result = await response.json();
            if (result.success) {
              console.log("Dashboard: 매장 목록 새로고침 완료", {
                storesCount: result.data?.length || 0,
              });
            }
          }
        } catch (error) {
          console.error("Dashboard: 매장 목록 새로고침 실패", error);
        }
      };

      refreshStores();
    }
  }, [loading, user]);

  useEffect(() => {
    if (process.env.NODE_ENV === "development" && !loading) {
      console.log("Dashboard: 렌더링", {
        user: user?.email || "없음",
        currentStore: currentStore?.name || "없음",
        accessibleStores: accessibleStores.length,
      });
    }
  }, [loading, user, currentStore, accessibleStores]);

  useEffect(() => {
    if (
      !loading &&
      !storesLoading &&
      user &&
      userRole === "MASTER" &&
      accessibleStores.length === 0
    ) {
      console.log("Dashboard: 마스터 사용자 스토어 없음, 모달 표시");
      setShowNoStoreModal(true);
    } else {
      setShowNoStoreModal(false);
    }
  }, [loading, storesLoading, user, userRole, accessibleStores.length]);

  const handleGoToStoreCreate = () => {
    setShowNoStoreModal(false);
    router.push(`/${locale}/stores/create`);
  };

  useEffect(() => {
    if (!loading && !user) {
      if (process.env.NODE_ENV === "development") {
        console.log(
          "Dashboard: 인증되지 않은 사용자, 로그인 페이지로 리다이렉트"
        );
      }
      router.push(`/${locale}/login`);
    }
  }, [loading, user, router, locale]);

  if (loading || storesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-lg font-medium text-gray-700">
            {t("dashboard.loading", currentLocale)}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            {t("dashboard.wait", currentLocale)}
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const desktopNavItems = useMemo(() => {
    const items: Array<{
      key: string;
      label: string;
      icon: typeof Calendar;
      onClick: () => void;
      disabled?: boolean;
    }> = [
      {
        key: "schedule",
        label: t("dashboard.schedule", currentLocale),
        icon: Calendar,
        onClick: () => router.push(`/${locale}/schedule`),
      },
      {
        key: "shiftRequests",
        label: t("dashboard.shiftRequests", currentLocale),
        icon: MessageSquare,
        onClick: () => router.push(`/${locale}/shifts`),
        disabled: true,
      },
      {
        key: "settings",
        label: t("dashboard.settings", currentLocale),
        icon: Settings,
        onClick: () => router.push(`/${locale}/profile`),
      },
    ];

    if (canManageUsers || isManager) {
      items.push({
        key: "users",
        label: t("dashboard.userManagement", currentLocale),
        icon: UserPlus,
        onClick: () => router.push(`/${locale}/stores/${currentStore?.id}/users`),
        disabled: !currentStore,
      });
    }

    if (userRole === "MASTER") {
      items.push({
        key: "stores",
        label: t("dashboard.storeManagement", currentLocale),
        icon: Store,
        onClick: () => router.push(`/${locale}/stores`),
      });
    }

    items.push({
      key: "analytics",
      label: t("dashboard.analytics", currentLocale),
      icon: BarChart3,
      onClick: () => {},
      disabled: !(canViewAnalytics || isManager),
    });

    return items;
  }, [
    canManageUsers,
    canViewAnalytics,
    currentLocale,
    currentStore,
    isManager,
    locale,
    router,
    userRole,
  ]);

  const handleSignOut = async () => {
    await signOut();
    router.push(`/${locale}/login`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <ResponsiveHeader
        userEmail={user?.email}
        currentStoreRole={userRole as UserRole}
        locale={locale as string}
        onLogout={handleSignOut}
      />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {t("dashboard.welcome", currentLocale, { name: user.email })}
          </h2>
          {currentStore && (
            <p className="text-gray-600">
              {t("dashboard.currentStore", currentLocale, {
                storeName: currentStore.name,
                role: t(
                  `store.role.${(
                    currentStore.user_role || "master"
                  ).toLowerCase()}`,
                  currentLocale
                ),
              })}
            </p>
          )}
        </div>

        {(user as any).user_metadata?.is_invited_user &&
          (user as any).user_metadata?.needs_password_change && (
            <Card className="mb-6 border-orange-200 bg-orange-50">
              <CardContent className="pt-6">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                      <Settings className="h-4 w-4 text-orange-600" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-orange-900">
                      {t("dashboard.passwordChangeRequired", currentLocale)}
                    </h3>
                    <p className="text-sm text-orange-700 mt-1">
                      {t("dashboard.passwordChangeDescription", currentLocale)}
                    </p>
                    <div className="mt-3">
                      <Button
                        size="sm"
                        onClick={() => router.push(`/${locale}/profile`)}
                        className="bg-orange-600 hover:bg-orange-700"
                      >
                        {t("dashboard.passwordChangeButton", currentLocale)}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

        {accessibleStores.length === 0 && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="text-center">
                <Store className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {t("dashboard.noStores", currentLocale)}
                </h3>
                <p className="text-gray-600 mb-4">
                  {t("dashboard.noStoresDescription", currentLocale)}
                </p>
                <MasterOnly>
                  <Button onClick={() => router.push(`/${locale}/stores/create`)}>
                    <Store className="h-4 w-4 mr-2" />
                    {t("store.createFirst", currentLocale)}
                  </Button>
                </MasterOnly>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="hidden lg:grid lg:grid-cols-[280px_minmax(0,1fr)] gap-6">
          <aside className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t("dashboard.title", currentLocale)}</CardTitle>
                <CardDescription>{t("dashboard.quickActions", currentLocale)}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {desktopNavItems.map((item) => {
                  const Icon = item.icon;
                  const isAnalytics = item.key === "analytics";
                  return (
                    <Button
                      key={item.key}
                      variant={isAnalytics ? "default" : "outline"}
                      className="w-full justify-start"
                      onClick={item.onClick}
                      disabled={item.disabled}
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {item.label}
                    </Button>
                  );
                })}
              </CardContent>
            </Card>

            {canManageStore && currentStore && (
              <Card>
                <CardContent className="pt-6">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() =>
                      router.push(
                        `/${locale}/stores/${currentStore.id}/edit?from=dashboard`
                      )
                    }
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    {t("dashboard.storeSettings", currentLocale)}
                  </Button>
                </CardContent>
              </Card>
            )}
          </aside>

          <section>
            <WorkHoursAnalyticsPanel
              locale={currentLocale}
              storeId={currentStore?.id}
              storeName={currentStore?.name}
              hasAnalyticsAccess={canViewAnalytics || isManager}
            />
          </section>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:hidden gap-6">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                {t("dashboard.schedule", currentLocale)}
              </CardTitle>
              <CardDescription>
                {t("dashboard.scheduleDescription", currentLocale)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => router.push(`/${locale}/schedule`)}
                >
                  {t("dashboard.viewSchedule", currentLocale)}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                {t("dashboard.shiftRequests", currentLocale)}
              </CardTitle>
              <CardDescription>
                {t("dashboard.shiftRequestsDescription", currentLocale)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => router.push(`/${locale}/shifts`)}
                  disabled
                >
                  {t("dashboard.viewRequests", currentLocale)}
                </Button>
                {canApproveShifts && (
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => router.push(`/${locale}/shifts/approve`)}
                    disabled
                  >
                    {t("dashboard.approveRequests", currentLocale)}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {(canManageUsers || isManager) && (
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  {t("dashboard.userManagement", currentLocale)}
                </CardTitle>
                <CardDescription>
                  {t("dashboard.userManagementDescription", currentLocale)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() =>
                      router.push(`/${locale}/stores/${currentStore?.id}/users`)
                    }
                    disabled={!currentStore}
                  >
                    {t("dashboard.viewUsers", currentLocale)}
                  </Button>
                  {canManageUsers && (
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() =>
                        router.push(`/${locale}/stores/${currentStore?.id}/users`)
                      }
                      disabled={!currentStore}
                    >
                      {t("dashboard.inviteUsers", currentLocale)}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <MasterOnly>
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Store className="h-5 w-5" />
                  {t("dashboard.storeManagement", currentLocale)}
                </CardTitle>
                <CardDescription>
                  {t("dashboard.storeManagementDescription", currentLocale)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => router.push(`/${locale}/stores`)}
                  >
                    {t("dashboard.viewStores", currentLocale)}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => router.push(`/${locale}/stores/create`)}
                  >
                    {t("dashboard.createStore", currentLocale)}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </MasterOnly>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                {t("dashboard.settings", currentLocale)}
              </CardTitle>
              <CardDescription>
                {t("dashboard.settingsDescription", currentLocale)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => router.push(`/${locale}/profile`)}
                >
                  {t("dashboard.profile", currentLocale)}
                </Button>
                {canManageStore && currentStore && (
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() =>
                      router.push(
                        `/${locale}/stores/${currentStore.id}/edit?from=dashboard`
                      )
                    }
                  >
                    {t("dashboard.storeSettings", currentLocale)}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {(canViewAnalytics || isManager) && (
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  {t("dashboard.analytics", currentLocale)}
                </CardTitle>
                <CardDescription>
                  {t("dashboard.analyticsDescription", currentLocale)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => router.push(`/${locale}/dashboard/analytics`)}
                    disabled={!currentStore}
                  >
                    {t("dashboard.viewAnalytics", currentLocale)}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <Dialog open={showNoStoreModal} onOpenChange={setShowNoStoreModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("dashboard.noStoresModal.title", currentLocale)}
            </DialogTitle>
            <DialogDescription>
              {t("dashboard.noStoresModal.description", currentLocale)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              {t("dashboard.noStoresModal.message", currentLocale)}
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowNoStoreModal(false)}
            >
              {t("common.cancel", currentLocale)}
            </Button>
            <Button onClick={handleGoToStoreCreate}>
              <Store className="h-4 w-4 mr-2" />
              {t("dashboard.noStoresModal.goToCreate", currentLocale)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
