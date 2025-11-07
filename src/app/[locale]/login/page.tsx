"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
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
import { defaultLocale } from "@/lib/i18n-config";
import { useAuth } from "@/contexts/auth-context";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";

function SignInContent() {
  const { locale } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentLocale = (locale as Locale) || defaultLocale;
  const { user, loading, isProcessingInvite, setProcessingInvite } = useAuth();
  const { toast } = useToast();

  const sessionExpired = searchParams.get("sessionExpired") === "true";

  // 초대 링크 처리 (URL 해시에서 access_token 확인)
  useEffect(() => {
    const handleInviteToken = async () => {
      // URL 해시와 쿼리 파라미터 모두 확인
      const hash = window.location.hash;
      const searchParams = window.location.search;

      console.log("LoginPage: URL 분석", {
        hash: hash.substring(0, 100) + "...",
        searchParams,
        fullUrl: window.location.href,
      });

      // 해시에서 access_token 확인
      if (hash && hash.includes("access_token")) {
        setProcessingInvite(true);

        const urlParams = new URLSearchParams(hash.substring(1));
        const accessToken = urlParams.get("access_token");
        const type = urlParams.get("type");

        console.log("LoginPage: URL 해시 파싱", {
          accessToken: !!accessToken,
          type,
          urlParams: Object.fromEntries(urlParams.entries()),
        });

        if (accessToken && type === "invite") {
          console.log("LoginPage: 초대 토큰 감지", {
            accessToken: accessToken.substring(0, 20) + "...",
            type,
          });

          const supabase = createClient();

          // 토큰으로 세션 설정
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: urlParams.get("refresh_token") || "",
          });

          if (error) {
            console.error("LoginPage: 세션 설정 실패:", error);
            toast({
              title: "초대 링크 오류",
              description:
                "초대 링크 처리 중 오류가 발생했습니다. 다시 시도해주세요.",
              variant: "destructive",
            });
            setProcessingInvite(false);
            return;
          }

          console.log("LoginPage: 세션 설정 성공", {
            user: data.user?.email,
            userMetadata: data.user?.user_metadata,
          });

          if (data.user?.user_metadata?.type === "store_invitation") {
            const tokenHash = data.user.user_metadata?.token_hash;
            if (tokenHash) {
              console.log(
                "LoginPage: 패스워드 설정 페이지로 리다이렉트",
                tokenHash
              );
              router.push(
                `/${currentLocale}/invites/setup-password/${tokenHash}`
              );
              return;
            } else {
              console.log(
                "LoginPage: 토큰 해시가 없음",
                data.user.user_metadata
              );
            }
          } else {
            console.log(
              "LoginPage: 스토어 초대가 아님",
              data.user?.user_metadata?.type
            );
          }
        }

        setProcessingInvite(false);
      }
    };

    // 즉시 실행
    handleInviteToken();

    // 추가로 1초, 2초, 3초 후에도 다시 확인 (해시가 늦게 로드되는 경우)
    const timeoutId1 = setTimeout(() => {
      console.log("LoginPage: 1초 후 URL 해시 재확인");
      handleInviteToken();
    }, 1000);

    const timeoutId2 = setTimeout(() => {
      console.log("LoginPage: 2초 후 URL 해시 재확인");
      handleInviteToken();
    }, 2000);

    const timeoutId3 = setTimeout(() => {
      console.log("LoginPage: 3초 후 URL 해시 재확인");
      handleInviteToken();
    }, 3000);

    return () => {
      clearTimeout(timeoutId1);
      clearTimeout(timeoutId2);
      clearTimeout(timeoutId3);
    };
  }, [currentLocale, router, toast]);

  // 인증 상태 체크 및 리다이렉트
  useEffect(() => {
    console.log("LoginPage: 인증 상태 체크", {
      loading,
      user: user ? { id: user.id, email: user.email, role: user.role } : null,
      currentPath: window.location.pathname,
      isProcessingInvite,
    });

    // 초대 토큰 처리 중이거나 URL 해시가 있는 경우 리다이렉트 지연
    const hasInviteHash = window.location.hash.includes("access_token");

    if (!loading && user && !isProcessingInvite && !hasInviteHash) {
      const redirectTo = searchParams.get("redirectTo") || "/dashboard";
      const fullRedirectTo = `/${locale}${redirectTo}`;
      console.log("LoginPage: 이미 로그인됨, 리다이렉트", { fullRedirectTo });
      router.replace(fullRedirectTo);
    }
  }, [user, loading, router, locale, searchParams, isProcessingInvite]);

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

  // 로딩 중이거나 이미 로그인된 경우 또는 초대 링크 처리 중 로딩 표시
  if (loading || user || isProcessingInvite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg font-medium text-gray-700">
            {isProcessingInvite ? "초대 링크 처리 중..." : "로딩 중..."}
          </p>
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
