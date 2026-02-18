"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { t, type Locale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";

interface AcceptInvitationPageProps {
  params: Promise<{
    locale: string;
    token: string;
  }>;
}

export default function AcceptInvitationPage({
  params,
}: AcceptInvitationPageProps) {
  const resolvedParams = useParams();
  const locale = resolvedParams.locale as Locale;
  const token = resolvedParams.token as string;
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const handleInvitation = async () => {
      try {
        console.log("초대 링크 처리 시작:", { token });

        // URL 해시에서 토큰이 있는지 확인
        const hash = window.location.hash;

        // 오류 처리
        if (hash && hash.includes("error=")) {
          console.log("초대 링크 오류 감지, 오류 페이지로 리다이렉트");
          router.push(`/${locale}/invites/error`);
          return;
        }

        // Supabase Auth 토큰이 있는 경우
        if (hash && hash.includes("access_token")) {
          const urlParams = new URLSearchParams(hash.substring(1));
          const accessToken = urlParams.get("access_token");
          const type = urlParams.get("type");

          if (accessToken && type === "invite") {
            console.log("Supabase Auth 토큰 감지, verify-email로 리다이렉트");

            const supabase = createClient();

            // 토큰으로 세션 설정
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: urlParams.get("refresh_token") || "",
            });

            if (error) {
              console.error("세션 설정 실패:", error);
              toast({
                title: t("invite.error.title", locale),
                description: t("invite.error.processing", locale),
                variant: "destructive",
              });
              router.push(`/${locale}/invites/error`);
              return;
            }

            // verify-email 페이지로 리다이렉트
            router.push(`/${locale}/invites/verify-email?token=${token}`);
            return;
          }
        }

        // 기존 토큰만 있는 경우 (레거시 지원)
        console.log("기존 토큰 감지, verify-email로 리다이렉트");
        router.push(`/${locale}/invites/verify-email?token=${token}`);
      } catch (error) {
        console.error("초대 링크 처리 실패:", error);
        toast({
          title: t("invite.error.title", locale),
          description: t("invite.error.processing", locale),
          variant: "destructive",
        });
        router.push(`/${locale}/invites/error`);
      }
    };

    if (token) {
      handleInvitation();
    }
  }, [token, locale, router, toast]);

  // 로딩 중 표시
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p>{t("invite.accept.loading", locale)}</p>
      </div>
    </div>
  );
}
