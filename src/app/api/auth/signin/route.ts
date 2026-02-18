import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import {
  defaultLocale,
  isValidLocale,
  t,
  type Locale,
} from "@/lib/i18n";
import { createSignInSchema } from "@/lib/validations/auth";

function resolveLocale(request: NextRequest, localeParam?: string): Locale {
  if (localeParam && isValidLocale(localeParam)) {
    return localeParam;
  }

  const acceptLanguage = request.headers.get("accept-language");
  const preferredLocale = acceptLanguage?.split(",")[0]?.split("-")[0];

  if (preferredLocale && isValidLocale(preferredLocale)) {
    return preferredLocale;
  }

  return defaultLocale;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const localeParam = typeof body?.locale === "string" ? body.locale : undefined;
    const locale = resolveLocale(request, localeParam);
    const signInSchema = createSignInSchema(locale);

    // 입력 데이터 검증
    const validationResult = signInSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: t("auth.login.validation.invalidData", locale),
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { email, password } = validationResult.data;

    // Supabase Auth로 로그인 처리
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error("로그인 처리 중 오류:", error);

      // Supabase 에러 코드에 따른 사용자 친화적 메시지
      let errorMessage = t("auth.login.error.general", locale);

      if (
        error.message.includes("Invalid login credentials") ||
        error.message.includes("invalid_credentials")
      ) {
        errorMessage = t("auth.login.error.invalidCredentials", locale);
      } else if (error.message.includes("Email not confirmed")) {
        errorMessage = t("auth.login.error.emailNotConfirmed", locale);
      } else if (error.message.includes("Too many requests")) {
        errorMessage = t("auth.login.error.tooManyRequests", locale);
      } else if (error.message.includes("User not found")) {
        errorMessage = t("auth.login.error.userNotFound", locale);
      }

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          code: error.message,
        },
        { status: 401 }
      );
    }

    // 로그인 성공
    return NextResponse.json({
      success: true,
      message: t("auth.login.successDescription", locale),
      data: {
        user: {
          id: data.user?.id,
          email: data.user?.email,
          emailConfirmed: data.user?.email_confirmed_at != null,
        },
        session: {
          accessToken: data.session?.access_token,
          refreshToken: data.session?.refresh_token,
          expiresAt: data.session?.expires_at,
        },
      },
    });
  } catch (error) {
    console.error("로그인 API 오류:", error);
    const locale: Locale = defaultLocale;
    return NextResponse.json(
      {
        success: false,
        error: t("auth.login.error.general", locale),
      },
      { status: 500 }
    );
  }
}
