"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { type Locale } from "@/lib/i18n";
import { defaultLocale } from "@/lib/i18n-config";
import { createClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();
  const { locale } = useParams();
  const currentLocale = (locale as Locale) || defaultLocale;
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkUserAndRedirect = async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          // 일반 회원가입 사용자 (초대되지 않은 사용자)는 회원가입 완료 페이지로 리다이렉트
          if (
            !user.user_metadata?.is_invited_user &&
            user.user_metadata?.type !== "store_invitation"
          ) {
            console.log(
              "AuthCallbackPage: 일반 회원가입 사용자, 회원가입 완료 페이지로 리다이렉트"
            );
            router.replace(`/${currentLocale}/auth/signup-complete`);
            return;
          }
        }

        // 초대된 사용자이거나 사용자 정보가 없으면 대시보드로 리다이렉트
        router.replace(`/${currentLocale}/dashboard`);
      } catch (error) {
        console.error("AuthCallbackPage: 사용자 확인 실패", error);
        // 오류 발생 시 대시보드로 리다이렉트
        router.replace(`/${currentLocale}/dashboard`);
      } finally {
        setIsChecking(false);
      }
    };

    checkUserAndRedirect();
  }, [router, currentLocale]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-blue-600" />
        <p className="text-lg font-medium text-gray-700">인증 처리 중...</p>
        <p className="text-sm text-gray-500 mt-2">잠시만 기다려주세요.</p>
      </div>
    </div>
  );
}
