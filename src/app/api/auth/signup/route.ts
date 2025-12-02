import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { UserRole } from "@/types/auth";
import { getEmailVerificationRedirectUrl } from "@/lib/env";
import { t, type Locale, isValidLocale, defaultLocale } from "@/lib/i18n";

// 회원가입 요청 스키마 (서버 사이드에서는 메시지를 동적으로 생성)
const createSignUpSchema = (locale: Locale) =>
  z
    .object({
      email: z.string().email(t("auth.signup.validation.invalidEmail", locale)),
      password: z
        .string()
        .min(8, t("auth.signup.validation.passwordMinLength", locale)),
      confirmPassword: z.string(),
      locale: z.string().optional(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t("auth.signup.validation.passwordMismatch", locale),
      path: ["confirmPassword"],
    });

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // locale 추출 (body에서 또는 기본값 사용)
    const localeParam = body.locale;
    const locale: Locale = isValidLocale(localeParam)
      ? localeParam
      : defaultLocale;

    // 입력 데이터 검증
    const signUpSchema = createSignUpSchema(locale);
    const validationResult = signUpSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: t("auth.signup.validation.invalidData", locale),
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { email, password } = validationResult.data;

    // Supabase Auth로 회원가입 처리
    const supabase = await createClient();

    // 회원가입 폼을 통해 가입하는 사용자는 마스터로 가입
    const userRole = UserRole.MASTER;

    // emailRedirectTo URL을 locale에 맞게 동적으로 생성
    // 이메일 확인 후 회원가입 완료 페이지로 리다이렉트
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://easy-work-ten.vercel.app";
    const emailRedirectTo = `${appUrl}/${locale}/auth/signup-complete`;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // 사용자 메타데이터에 역할 정보 저장
        data: {
          role: userRole,
          name: email.split("@")[0], // 이메일의 @ 앞부분을 기본 이름으로 사용
        },
        // 이메일 확인 후 리다이렉트할 URL (locale에 맞게 동적 생성)
        emailRedirectTo,
      },
    });

    console.log("회원가입 결과:", data);

    if (error) {
      console.error("회원가입 처리 중 오류:", error);

      // Supabase 에러 코드에 따른 사용자 친화적 메시지
      let errorMessage = t("auth.signup.error.general", locale);

      if (
        error.message.includes("already registered") ||
        error.message.includes("User already registered")
      ) {
        errorMessage = t("auth.signup.error.alreadyRegistered", locale);
      } else if (error.message.includes("password")) {
        errorMessage = t("auth.signup.error.passwordInvalid", locale);
      } else if (
        error.message.includes("invalid") &&
        error.message.includes("email")
      ) {
        errorMessage = t("auth.signup.error.invalidEmail", locale);
      } else if (error.message.includes("email")) {
        errorMessage = t("auth.signup.error.emailCheck", locale);
      } else if (error.message.includes("Signup is disabled")) {
        errorMessage = t("auth.signup.error.signupDisabled", locale);
      }

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          code: error.message,
        },
        { status: 400 }
      );
    }

    // 회원가입 성공
    return NextResponse.json({
      success: true,
      message: t("auth.signup.success.message", locale),
      data: {
        user: {
          id: data.user?.id,
          email: data.user?.email,
          role: userRole,
        },
        needsEmailConfirmation: !data.session, // 세션이 없으면 이메일 확인 필요
      },
    });
  } catch (error) {
    console.error("회원가입 API 오류:", error);
    // catch 블록에서는 locale을 알 수 없으므로 기본 locale 사용
    const locale: Locale = defaultLocale;
    return NextResponse.json(
      {
        success: false,
        error: t("auth.signup.error.serverError", locale),
      },
      { status: 500 }
    );
  }
}
