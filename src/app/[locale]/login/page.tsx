"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SignInForm } from "@/features/auth/components/signin-form";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { type AuthApiResponse } from "@/lib/validations/auth";
import { t, type Locale } from "@/lib/i18n";
import { useAuth } from "@/contexts/auth-context";

function SignInContent() {
  const { locale } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentLocale = (locale as Locale) || "ko";
  const { user, loading } = useAuth();

  const sessionExpired = searchParams.get("sessionExpired") === "true";

  // 이미 로그인된 사용자는 대시보드로 리다이렉트
  useEffect(() => {
    console.log("LoginPage: 인증 상태 체크", {
      loading,
      user: user ? { id: user.id, email: user.email, role: user.role } : null,
      currentPath: window.location.pathname,
    });

    if (!loading && user) {
      const redirectTo = searchParams.get("redirectTo") || "/dashboard";
      const fullRedirectTo = `/${locale}${redirectTo}`;
      console.log("LoginPage: 이미 로그인됨, 리다이렉트", { fullRedirectTo });
      router.replace(fullRedirectTo);
    }
  }, [user, loading, router, locale, searchParams]);

  const handleSignInSuccess = (data: AuthApiResponse) => {
    console.log("LoginPage: 로그인 성공 콜백", { data });
    // 원래 접근하려던 페이지로 리다이렉트, 없으면 대시보드로
    const redirectTo = searchParams.get("redirectTo") || "/dashboard";
    const fullRedirectTo = `/${locale}${redirectTo}`;
    console.log("LoginPage: 로그인 성공 후 리다이렉트", { fullRedirectTo });
    router.replace(fullRedirectTo);
  };

  const handleSignInError = (error: string) => {
    // 에러는 이미 toast로 표시되므로 추가 처리가 필요한 경우에만 사용
    console.error("로그인 오류:", error);
  };

  // 로딩 중이거나 이미 로그인된 경우 로딩 표시
  if (loading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg font-medium text-gray-700">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* 언어 스위처 */}
        <div className="flex justify-end">
          <LanguageSwitcher />
        </div>

        {/* 헤더 */}
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            {t("auth.login.title", currentLocale)}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {t("auth.login.noAccount", currentLocale)}{" "}
            <Link
              href={`/${locale}/signup`}
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              {t("auth.login.signup", currentLocale)}
            </Link>
          </p>
        </div>

        {/* 세션 만료 알림 */}
        {sessionExpired && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <div className="text-sm text-yellow-800">
              {t("auth.login.sessionExpired", currentLocale)}
            </div>
          </div>
        )}

        {/* 로그인 폼 카드 */}
        <Card>
          <CardHeader>
            <CardTitle>{t("auth.login.loginCard", currentLocale)}</CardTitle>
            <CardDescription>
              {t("auth.login.description", currentLocale)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SignInForm
              onSuccess={handleSignInSuccess}
              onError={handleSignInError}
            />
          </CardContent>
        </Card>

        {/* 비밀번호 찾기 링크 */}
        <div className="text-center">
          <Link
            href={`/${locale}/auth/forgot-password`}
            className="text-sm text-blue-600 hover:text-blue-500"
          >
            {t("auth.login.forgotPassword", currentLocale)}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SignInContent />
    </Suspense>
  );
}
