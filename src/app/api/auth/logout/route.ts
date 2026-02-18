import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { defaultLocale, isValidLocale, t, type Locale } from "@/lib/i18n";

function resolveLocale(request: NextRequest): Locale {
  const localeParam = request.nextUrl.searchParams.get("locale");
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

// 로그아웃 API 엔드포인트
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const locale = resolveLocale(request);

  try {
    // 현재 세션 확인
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error("세션 확인 오류:", sessionError);
    }

    // 로그아웃 실행 (세션이 없어도 진행)
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("로그아웃 처리 중 오류:", error);
      return NextResponse.json(
        {
          success: false,
          error: t("auth.logout.error", locale),
          code: error.message,
        },
        { status: 500 }
      );
    }

    // 성공 응답 (쿠키 삭제 포함)
    const response = NextResponse.json({
      success: true,
      message: t("auth.logout.success", locale),
    });

    // 인증 관련 쿠키 명시적 삭제
    response.cookies.delete("sb-access-token");
    response.cookies.delete("sb-refresh-token");

    return response;
  } catch (error) {
    console.error("로그아웃 API 오류:", error);
    return NextResponse.json(
      {
        success: false,
        error: t("auth.signup.error.serverError", locale),
      },
      { status: 500 }
    );
  }
}
