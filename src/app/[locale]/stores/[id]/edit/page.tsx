"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { usePermissions } from "@/hooks/use-permissions";
import { StoreForm } from "@/features/stores/components/store-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
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

export default function EditStorePage() {
  const { locale, id } = useParams();
  const { user, loading } = useAuth();
  const { userRole } = usePermissions();
  const router = useRouter();
  const { toast } = useToast();
  const currentLocale = (locale as Locale) || "ko";
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

        // 권한 확인: 마스터이거나 해당 매장의 소유자여야 함
        if (userRole !== "MASTER" && data.data.owner_id !== user?.id) {
          toast({
            title: t("common.error", currentLocale),
            description: t("store.noPermission", currentLocale),
            variant: "destructive",
          });
          router.push(`/${locale}/stores`);
        }
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

  // 로딩 중인 경우
  if (loading || isLoading) {
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

  // 사용자가 없으면 리다이렉트 중이므로 아무것도 표시하지 않음
  if (!user) {
    return null;
  }

  // 매장이 없으면 404
  if (!store) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
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
      {/* 헤더 */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                onClick={() => router.push(`/${locale}/stores/${storeId}`)}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>{t("common.back", currentLocale)}</span>
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {t("store.editTitle", currentLocale)}
                </h1>
                <p className="text-gray-600">
                  {t("store.editDescription", currentLocale)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <StoreForm
              mode="edit"
              storeId={storeId}
              initialData={store}
              onSuccess={() => {
                router.push(`/${locale}/stores/${storeId}`);
              }}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
