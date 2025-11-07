"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { type Locale } from "@/lib/i18n";
import { defaultLocale } from "@/lib/i18n-config";

export default function AuthCallbackPage() {
  const router = useRouter();
  const { locale } = useParams();
  const currentLocale = (locale as Locale) || defaultLocale;

  useEffect(() => {
    // 즉시 대시보드로 리다이렉트 (지연 제거)
    router.replace(`/${currentLocale}/dashboard`);
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
