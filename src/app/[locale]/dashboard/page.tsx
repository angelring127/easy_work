"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useStore } from "@/contexts/store-context";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { StoreSwitcher } from "@/components/ui/store-switcher";
import { usePermissions, useAdminAccess } from "@/hooks/use-permissions";
import { RoleBadge } from "@/components/auth/role-badge";
import { AdminOnly, MasterOnly } from "@/components/auth/permission-guard";
import { UserRole } from "@/types/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  LogOut,
  User,
  Calendar,
  MessageSquare,
  UserPlus,
  Store,
  Settings,
} from "lucide-react";
import { t, type Locale } from "@/lib/i18n";

export default function DashboardPage() {
  const { locale } = useParams();
  const { user, loading, signOut } = useAuth();
  const {
    currentStore,
    accessibleStores,
    isLoading: storesLoading,
  } = useStore();
  const router = useRouter();
  const currentLocale = (locale as Locale) || "ko";

  // 권한 관련 훅
  const { userRole, roleDisplayName } = usePermissions();
  const {
    canManageStore,
    canManageUsers,
    canCreateSchedule,
    canApproveShifts,
    canViewAnalytics,
    isManager,
  } = useAdminAccess();

  // 디버깅을 위한 상태 로그 (최소화)
  useEffect(() => {
    if (process.env.NODE_ENV === "development" && !loading) {
      console.log("Dashboard: 렌더링", {
        user: user?.email || "없음",
        currentStore: currentStore?.name || "없음",
        accessibleStores: accessibleStores.length,
      });
    }
  }, [loading, user, currentStore, accessibleStores]);

  // 로그인하지 않은 경우 로그인 페이지로 리다이렉트 (useEffect 사용)
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

  // 로딩 중인 경우에만 로딩 UI 표시
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

  // 사용자가 없으면 리다이렉트 중이므로 아무것도 표시하지 않음
  if (!user) {
    return null;
  }

  const handleSignOut = async () => {
    await signOut();
    router.push(`/${locale}/login`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <h1 className="text-3xl font-bold text-gray-900">Workeasy</h1>
            </div>
            <div className="flex items-center space-x-4">
              <LanguageSwitcher />
              <StoreSwitcher />
              <div className="flex items-center space-x-2">
                <User className="h-5 w-5" />
                <span className="text-sm font-medium">{user.email}</span>
                {userRole && <RoleBadge role={userRole} className="text-xs" />}
              </div>
              <Button
                variant="outline"
                onClick={handleSignOut}
                className="flex items-center space-x-2"
              >
                <LogOut className="h-4 w-4" />
                <span>{t("dashboard.logout", currentLocale)}</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* 환영 메시지 */}
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

        {/* 매장이 없는 경우 안내 */}
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
                  <Button
                    onClick={() => router.push(`/${locale}/stores/create`)}
                  >
                    <Store className="h-4 w-4 mr-2" />
                    {t("store.createFirst", currentLocale)}
                  </Button>
                </MasterOnly>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 기능 카드 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* 스케줄 관리 */}
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
                {canCreateSchedule && (
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => router.push(`/${locale}/schedule/create`)}
                  >
                    {t("dashboard.createSchedule", currentLocale)}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 교대 요청 */}
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
                >
                  {t("dashboard.viewRequests", currentLocale)}
                </Button>
                {canApproveShifts && (
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => router.push(`/${locale}/shifts/approve`)}
                  >
                    {t("dashboard.approveRequests", currentLocale)}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 사용자 관리 */}
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

          {/* 매장 관리 */}
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

          {/* 설정 */}
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
                        `/${locale}/stores/${currentStore.id}/settings`
                      )
                    }
                  >
                    {t("dashboard.storeSettings", currentLocale)}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 분석 (관리자만) */}
          {canViewAnalytics && (
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
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
                    onClick={() => router.push(`/${locale}/analytics`)}
                  >
                    {t("dashboard.viewAnalytics", currentLocale)}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* 빠른 액션 */}
        {isManager && (
          <div className="mt-8">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {t("dashboard.quickActions", currentLocale)}
            </h3>
            <div className="flex flex-wrap gap-4">
              {canCreateSchedule && (
                <Button
                  variant="outline"
                  onClick={() => router.push(`/${locale}/schedule/create`)}
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  {t("dashboard.quickCreateSchedule", currentLocale)}
                </Button>
              )}
              {canManageUsers && (
                <Button
                  variant="outline"
                  onClick={() => router.push(`/${locale}/users/invite`)}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  {t("dashboard.quickInviteUser", currentLocale)}
                </Button>
              )}
              {canApproveShifts && (
                <Button
                  variant="outline"
                  onClick={() => router.push(`/${locale}/shifts/approve`)}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  {t("dashboard.quickApproveShifts", currentLocale)}
                </Button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
