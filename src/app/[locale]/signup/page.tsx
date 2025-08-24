"use client";

import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SignUpForm } from "@/features/auth/components/signup-form";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { type AuthApiResponse } from "@/lib/validations/auth";
import { t, type Locale } from "@/lib/i18n";

export default function SignUpPage() {
  const { locale } = useParams();
  const router = useRouter();
  const currentLocale = (locale as Locale) || "ko";

  const handleSignUpSuccess = (data: AuthApiResponse) => {
    // 회원가입 성공 시 이메일 인증 페이지로 리다이렉트
    router.push(`/${locale}/auth/verify-email`);
  };

  const handleSignUpError = (error: string) => {
    // 에러는 이미 toast로 표시되므로 추가 처리가 필요한 경우에만 사용
    console.error("회원가입 오류:", error);
  };

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
            {t("auth.signup.title", currentLocale)}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {t("auth.signup.hasAccount", currentLocale)}{" "}
            <Link
              href={`/${locale}/login`}
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              {t("auth.signup.login", currentLocale)}
            </Link>
          </p>
        </div>

        {/* 회원가입 폼 카드 */}
        <Card>
          <CardHeader>
            <CardTitle>{t("auth.signup.signupCard", currentLocale)}</CardTitle>
            <CardDescription>
              {t("auth.signup.description", currentLocale)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SignUpForm
              onSuccess={handleSignUpSuccess}
              onError={handleSignUpError}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
