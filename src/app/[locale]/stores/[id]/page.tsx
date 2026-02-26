"use client";
import { defaultLocale } from "@/lib/i18n-config";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useStore } from "@/contexts/store-context";
import { usePermissions, useAdminAccess } from "@/hooks/use-permissions";
import { ResponsiveHeader } from "@/components/layout/responsive-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Store,
  Edit,
  ArrowLeft,
  MapPin,
  Phone,
  Clock,
  Users,
  Loader2,
} from "lucide-react";
import { t, type Locale } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";

interface StoreData {
  id: string;
  name: string;
  description?: string;
  address?: string;
  phone?: string;
  timezone: string;
  status: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
  user_role?: string;
}

export default function StoreDetailPage() {
  const { locale, id } = useParams();
  const { user, loading, signOut } = useAuth();
  const {
    currentStore,
    accessibleStores,
    isLoading: storesLoading,
  } = useStore();
  const { userRole } = usePermissions();
  const { canManageStore, canManageUsers, isManager } = useAdminAccess();
  const router = useRouter();
  const { toast } = useToast();
  const currentLocale = (locale as Locale) || defaultLocale;
  const storeId = id as string;

  const [store, setStore] = useState<StoreData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 로그인하지 않은 경우 로그인 페이지로 리다이렉트
  useEffect(() => {
    if (!loading && !user) {
      router.push(`/${locale}/login`);
    }
  }, [loading, user, router, locale]);

  // 매장 데이터 로드
  useEffect(() => {
    if (user && storeId) {
      loadStoreData();
    }
  }, [user, storeId]);

  const loadStoreData = async () => {
    try {
      const response = await fetch(`/api/stores/${storeId}`);
      if (response.ok) {
        const data = await response.json();
        setStore(data.data);
      } else {
        toast({
          title: t("common.error", currentLocale),
          description: t("store.loadError", currentLocale),
          variant: "destructive",
        });
        router.push(`/${locale}/stores`);
      }
    } catch (error) {
      console.error("매장 데이터 로드 오류:", error);
      toast({
        title: t("common.error", currentLocale),
        description: t("store.networkError", currentLocale),
        variant: "destructive",
      });
      router.push(`/${locale}/stores`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push(`/${locale}/login`);
  };

  const getRoleDisplayName = (role: string | undefined) => {
    if (!role) return t("store.role.part_timer", currentLocale);
    return t(`store.role.${role.toLowerCase()}`, currentLocale);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(currentLocale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // 로딩 중인 경우
  if (loading || storesLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-lg font-medium text-gray-700">
            {t("common.loading", currentLocale)}
          </p>
        </div>
      </div>
    );
  }

  // 사용자가 없으면 리다이렉트 중이므로 아무것도 표시하지 않음
  if (!user) {
    return null;
  }

  // 매장이 없으면 404
  if (!store) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Store className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {t("store.notFound", currentLocale)}
          </h3>
          <p className="text-gray-600 mb-4">
            {t("store.notFoundDescription", currentLocale)}
          </p>
          <Button onClick={() => router.push(`/${locale}/stores`)}>
            {t("common.back", currentLocale)}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ResponsiveHeader
        userEmail={user?.email}
        currentStoreRole={userRole}
        locale={locale as string}
        onLogout={handleSignOut}
      />

      {/* 메인 콘텐츠 */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* 뒤로가기 버튼 */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push(`/${locale}/stores`)}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{t("common.back", currentLocale)}</span>
          </Button>
        </div>

        {/* 매장 정보 헤더 */}
        <div className="mb-6">
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 break-words text-2xl font-bold text-gray-900 sm:text-3xl">
                <Store className="h-8 w-8" />
                {store.name}
              </h1>
              <p className="text-gray-600 break-words">
                {store.description || t("store.noDescription", currentLocale)}
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
              <Badge
                variant={store.user_role === "MASTER" ? "default" : "secondary"}
              >
                {getRoleDisplayName(store.user_role)}
              </Badge>
              {/* 액션 버튼들 */}
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() =>
                    router.push(`/${locale as Locale}/stores/${storeId}/users`)
                  }
                >
                  <Users className="h-4 w-4 mr-2" />
                  {t("user.management", locale as Locale)}
                </Button>
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() =>
                    router.push(`/${locale as Locale}/stores/${storeId}/edit`)
                  }
                >
                  <Edit className="h-4 w-4 mr-2" />
                  {t("store.edit", locale as Locale)}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 매장 정보 */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>{t("store.information", currentLocale)}</CardTitle>
                <CardDescription>
                  {t("store.informationDescription", currentLocale)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {store.address && (
                  <div className="flex items-start space-x-3">
                    <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="font-medium text-gray-900">
                        {t("store.address", currentLocale)}
                      </p>
                      <p className="text-gray-600">{store.address}</p>
                    </div>
                  </div>
                )}
                {store.phone && (
                  <div className="flex items-start space-x-3">
                    <Phone className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="font-medium text-gray-900">
                        {t("store.phone", currentLocale)}
                      </p>
                      <p className="text-gray-600">{store.phone}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-start space-x-3">
                  <Clock className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900">
                      {t("store.timezone", currentLocale)}
                    </p>
                    <p className="text-gray-600">{store.timezone}</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <Users className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900">
                      {t("store.status", currentLocale)}
                    </p>
                    <Badge
                      variant={
                        store.status === "ACTIVE" ? "default" : "secondary"
                      }
                    >
                      {t(
                        `store.status.${store.status.toLowerCase()}`,
                        currentLocale
                      )}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 사이드바 */}
          <div className="space-y-6">
            {/* 생성 정보 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {t("store.createdInfo", currentLocale)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <p className="text-sm font-medium text-gray-500">
                    {t("store.createdAt", currentLocale)}
                  </p>
                  <p className="text-sm text-gray-900">
                    {formatDate(store.created_at)}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">
                    {t("store.updatedAt", currentLocale)}
                  </p>
                  <p className="text-sm text-gray-900">
                    {formatDate(store.updated_at)}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* 빠른 액션 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {t("store.quickActions", currentLocale)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start">
                  <Users className="h-4 w-4 mr-2" />
                  {t("store.manageUsers", currentLocale)}
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Clock className="h-4 w-4 mr-2" />
                  {t("store.viewSchedule", currentLocale)}
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Store className="h-4 w-4 mr-2" />
                  {t("store.settings", currentLocale)}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
