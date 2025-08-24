"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useStore } from "@/contexts/store-context";
import { usePermissions } from "@/hooks/use-permissions";
import { MasterOnly } from "@/components/auth/permission-guard";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Store, Plus, Edit, Archive, ArrowLeft } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";

export default function StoresPage() {
  const { locale } = useParams();
  const { user, loading } = useAuth();
  const { accessibleStores, isLoading: storesLoading } = useStore();
  const { userRole } = usePermissions();
  const router = useRouter();
  const { toast } = useToast();
  const currentLocale = (locale as Locale) || "ko";

  // 로그인하지 않은 경우 로그인 페이지로 리다이렉트
  useEffect(() => {
    if (!loading && !user) {
      router.push(`/${locale}/login`);
    }
  }, [loading, user, router, locale]);

  // 로딩 중인 경우
  if (loading || storesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg font-medium text-gray-700">
            {t("common.loading", currentLocale)}
          </p>
        </div>
      </div>
    );
  }

  // 사용자가 없으면 리다이렉트 처리 중이므로 아무것도 표시하지 않음
  if (!user) {
    return null;
  }

  const handleCreateStore = () => {
    router.push(`/${locale}/stores/create`);
  };

  const handleEditStore = (storeId: string) => {
    router.push(`/${locale}/stores/${storeId}/edit`);
  };

  const handleViewStore = (storeId: string) => {
    router.push(`/${locale}/stores/${storeId}`);
  };

  const getRoleDisplayName = (role: string | undefined) => {
    if (!role) return t("store.role.part_timer", currentLocale);
    return t(`store.role.${role.toLowerCase()}`, currentLocale);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                onClick={() => router.push(`/${locale}/dashboard`)}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>{t("common.back", currentLocale)}</span>
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {t("dashboard.storeManagement", currentLocale)}
                </h1>
                <p className="text-gray-600">
                  {t("dashboard.storeManagementDescription", currentLocale)}
                </p>
              </div>
            </div>
            <MasterOnly>
              <Button
                onClick={handleCreateStore}
                className="flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>{t("dashboard.createStore", currentLocale)}</span>
              </Button>
            </MasterOnly>
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* 매장 목록 */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            {t("store.totalStores", currentLocale, {
              count: accessibleStores.length,
            })}
          </h2>
        </div>

        {accessibleStores.length === 0 ? (
          <Card>
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
                  <Button onClick={handleCreateStore}>
                    <Store className="h-4 w-4 mr-2" />
                    {t("store.createFirst", currentLocale)}
                  </Button>
                </MasterOnly>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {accessibleStores.map((store) => (
              <Card
                key={store.id}
                className="hover:shadow-lg transition-shadow"
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Store className="h-5 w-5" />
                        {store.name}
                      </CardTitle>
                      <CardDescription>
                        {store.description ||
                          t("store.noDescription", currentLocale)}
                      </CardDescription>
                    </div>
                    <Badge
                      variant={
                        store.user_role === "MASTER" ? "default" : "secondary"
                      }
                    >
                      {getRoleDisplayName(store.user_role)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {store.address && (
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">
                          {t("store.address", currentLocale)}:
                        </span>{" "}
                        {store.address}
                      </div>
                    )}
                    {store.phone && (
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">
                          {t("store.phone", currentLocale)}:
                        </span>{" "}
                        {store.phone}
                      </div>
                    )}
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">
                        {t("store.timezone", currentLocale)}:
                      </span>{" "}
                      {store.timezone}
                    </div>
                    <div className="flex space-x-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewStore(store.id)}
                        className="flex-1"
                      >
                        {t("common.view", currentLocale)}
                      </Button>
                      {store.user_role === "MASTER" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditStore(store.id)}
                          className="flex-1"
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          {t("common.edit", currentLocale)}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
