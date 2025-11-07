"use client";
import { defaultLocale } from "@/lib/i18n-config";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { usePermissions } from "@/hooks/use-permissions";
import { MasterOnly } from "@/components/auth/permission-guard";
import { StoreForm } from "@/features/stores/components/store-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";

export default function CreateStorePage() {
  const { locale } = useParams();
  const { user, loading } = useAuth();
  const { userRole } = usePermissions();
  const router = useRouter();
  const currentLocale = (locale as Locale) || defaultLocale;

  // 로그인하지 않은 경우 로그인 페이지로 리다이렉트
  useEffect(() => {
    if (!loading && !user) {
      router.push(`/${locale}/login`);
    }
  }, [loading, user, router, locale]);

  // 마스터가 아닌 경우 대시보드로 리다이렉트
  useEffect(() => {
    if (!loading && user && userRole !== "MASTER") {
      router.push(`/${locale}/dashboard`);
    }
  }, [loading, user, userRole, router, locale]);

  // 로딩 중인 경우
  if (loading) {
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

  // 사용자가 없거나 마스터가 아니면 리다이렉트 처리 중이므로 아무것도 표시하지 않음
  if (!user || userRole !== "MASTER") {
    return null;
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
                onClick={() => router.push(`/${locale}/stores`)}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>{t("common.back", currentLocale)}</span>
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {t("store.createTitle", currentLocale)}
                </h1>
                <p className="text-gray-600">
                  {t("store.createDescription", currentLocale)}
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
              mode="create"
              onSuccess={() => {
                router.push(`/${locale}/stores`);
              }}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
