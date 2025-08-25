import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/middleware";
import { locales, defaultLocale, isValidLocale } from "@/lib/i18n-config";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // 정적 파일과 API 루트는 스킵
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/static") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // === 1단계: 다국어 처리 ===

  // 언어 프리픽스가 이미 있는지 체크
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  if (!pathnameHasLocale) {
    // 언어 검출
    let locale = defaultLocale;

    // 쿠키에서 언어 가져오기
    const cookieLocale = request.cookies.get("locale")?.value;
    if (cookieLocale && isValidLocale(cookieLocale)) {
      locale = cookieLocale;
    } else {
      // Accept-Language 헤더에서 언어 검출
      const acceptLanguage = request.headers.get("accept-language");
      if (acceptLanguage) {
        const preferredLocale = acceptLanguage
          .split(",")
          .map((lang) => lang.split(";")[0].trim())
          .find((lang) => locales.includes(lang.split("-")[0] as any));

        if (preferredLocale) {
          locale = preferredLocale.split("-")[0] as any;
        }
      }
    }

    // 언어 프리픽스 추가하여 리다이렉트
    const newUrl = new URL(`/${locale}${pathname}`, request.url);
    return NextResponse.redirect(newUrl);
  }

  // === 2단계: 인증 처리 ===

  // 현재 언어 추출
  const currentLocale = pathname.split("/")[1];
  const pathWithoutLocale = pathname.replace(`/${currentLocale}`, "") || "/";

  // 인증이 필요하지 않은 페이지들
  const publicPaths = ["/", "/login", "/signup", "/auth", "/invites/error"];

  const isPublicPath = publicPaths.some(
    (path) =>
      pathWithoutLocale === path ||
      pathWithoutLocale.startsWith("/auth") ||
      pathWithoutLocale.startsWith("/invites/error")
  );

  if (isPublicPath) {
    return NextResponse.next();
  }

  // 보호된 경로에 대한 인증 체크
  try {
    const { supabase, response } = createClient(request);

    // 세션 확인
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    // 세션 오류가 있거나 세션이 없는 경우
    if (error || !session) {
      const loginUrl = new URL(`/${currentLocale}/login`, request.url);
      loginUrl.searchParams.set("redirectTo", pathWithoutLocale);
      return NextResponse.redirect(loginUrl);
    }

    // 세션 만료 체크
    if (session.expires_at) {
      const expiresAt = session.expires_at * 1000;
      const now = Date.now();

      if (now >= expiresAt) {
        // 세션 만료 시 로그인 페이지로 리다이렉트
        const loginUrl = new URL(`/${currentLocale}/login`, request.url);
        loginUrl.searchParams.set("redirectTo", pathWithoutLocale);
        loginUrl.searchParams.set("sessionExpired", "true");
        return NextResponse.redirect(loginUrl);
      }

      // 세션 만료 10분 전이면 갱신 시도
      const timeUntilExpiry = expiresAt - now;
      const refreshThreshold = 10 * 60 * 1000; // 10분

      if (timeUntilExpiry <= refreshThreshold) {
        try {
          const { error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) {
            console.error("미들웨어 세션 갱신 실패:", refreshError);
          }
        } catch (refreshError) {
          console.error("미들웨어 세션 갱신 중 오류:", refreshError);
        }
      }
    }

    // 인증된 사용자는 그대로 진행
    return response;
  } catch (error) {
    console.error("미들웨어 인증 체크 오류:", error);

    // 오류 발생 시 로그인 페이지로 리다이렉트
    const loginUrl = new URL(`/${currentLocale}/login`, request.url);
    loginUrl.searchParams.set("redirectTo", pathWithoutLocale);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: [
    // API, 정적 파일 제외하고 모든 경로에 적용 (다국어 처리를 위해 login, signup 포함)
    "/((?!api|_next/static|_next/image|favicon.ico|$).*)",
  ],
};
