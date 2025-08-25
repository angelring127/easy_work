"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { t, type Locale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";

export default function HomePage() {
  const { locale } = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { setProcessingInvite } = useAuth();
  const currentLocale = (locale as Locale) || "ko";

  useEffect(() => {
    // 초대 토큰 및 오류 처리
    const handleInviteToken = async () => {
      const hash = window.location.hash;

      console.log("HomePage: URL 해시 확인", {
        hash: hash.substring(0, 100) + "...",
        fullUrl: window.location.href,
      });

      // 오류 처리
      if (hash && hash.includes("error=")) {
        try {
          const urlParams = new URLSearchParams(hash.substring(1));
          const error = urlParams.get("error");
          const errorCode = urlParams.get("error_code");
          const errorDescription = urlParams.get("error_description");

          console.log("초대 링크 오류 감지:", {
            error,
            errorCode,
            errorDescription,
          });

          // 오류 페이지로 리다이렉트
          router.push(`/${currentLocale}/invites/error`);
          return;
        } catch (parseError) {
          console.error("URL 파라미터 파싱 오류:", parseError);
          router.push(`/${currentLocale}/invites/error`);
          return;
        }
      }

      // 초대 토큰 처리
      if (hash && hash.includes("access_token")) {
        const urlParams = new URLSearchParams(hash.substring(1));
        const accessToken = urlParams.get("access_token");
        const type = urlParams.get("type");

        console.log("HomePage: URL 해시 파싱:", {
          hash,
          accessToken: !!accessToken,
          type,
          urlParams: Object.fromEntries(urlParams.entries()),
        });

        if (accessToken && type === "invite") {
          console.log("HomePage: 초대 토큰 감지:", {
            accessToken: accessToken.substring(0, 20) + "...",
            type,
          });

          // 초대 토큰 처리 시작
          setProcessingInvite(true);

          const supabase = createClient();

          // 토큰으로 세션 설정
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: urlParams.get("refresh_token") || "",
          });

          if (error) {
            console.error("HomePage: 세션 설정 실패:", error);
            toast({
              title: "초대 링크 오류",
              description:
                "초대 링크 처리 중 오류가 발생했습니다. 다시 시도해주세요.",
              variant: "destructive",
            });
            setProcessingInvite(false);
            return;
          }

          console.log("HomePage: 세션 설정 성공:", {
            user: data.user?.email,
            userMetadata: data.user?.user_metadata,
          });

          if (data.user?.user_metadata?.type === "store_invitation") {
            const tokenHash = data.user.user_metadata?.token_hash;
            if (tokenHash) {
              console.log(
                "HomePage: 패스워드 설정 페이지로 리다이렉트:",
                tokenHash
              );
              router.push(
                `/${currentLocale}/invites/setup-password/${tokenHash}`
              );
              return;
            } else {
              console.log(
                "HomePage: 토큰 해시가 없음:",
                data.user.user_metadata
              );
            }
          } else {
            console.log(
              "HomePage: 스토어 초대가 아님:",
              data.user?.user_metadata?.type
            );
          }
        }
      }
    };

    // 즉시 실행
    handleInviteToken();

    // 추가로 1초, 2초, 3초 후에도 다시 확인 (해시가 늦게 로드되는 경우)
    const timeoutId1 = setTimeout(() => {
      console.log("HomePage: 1초 후 URL 해시 재확인");
      handleInviteToken();
    }, 1000);

    const timeoutId2 = setTimeout(() => {
      console.log("HomePage: 2초 후 URL 해시 재확인");
      handleInviteToken();
    }, 2000);

    const timeoutId3 = setTimeout(() => {
      console.log("HomePage: 3초 후 URL 해시 재확인");
      handleInviteToken();
    }, 3000);

    return () => {
      clearTimeout(timeoutId1);
      clearTimeout(timeoutId2);
      clearTimeout(timeoutId3);
    };
  }, [currentLocale, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="flex justify-between items-center p-6">
        <h1 className="text-2xl font-bold text-gray-900">Workeasy</h1>
        <LanguageSwitcher />
      </header>

      {/* Main Content */}
      <main className="flex flex-col items-center justify-center px-6 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-5xl font-bold text-gray-900 mb-6">
            {t("home.title", currentLocale)}
          </h2>
          <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto">
            {t("home.description", currentLocale)}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href={`/${locale}/login`}>
              <Button size="lg" className="w-full sm:w-auto">
                {t("home.login", currentLocale)}
              </Button>
            </Link>
            <Link href={`/${locale}/signup`}>
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                {t("home.signup", currentLocale)}
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
