import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// OAuth 콜백 처리 (Google, GitHub 등 소셜 로그인용)
// 초대 이메일 링크 처리
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const type = searchParams.get("type");
  const token = searchParams.get("token");
  const redirectTo = searchParams.get("redirect_to");

  console.log("Auth callback 처리:", {
    code: !!code,
    type,
    token: !!token,
    redirectTo,
    next,
    url: request.url,
  });

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // 초대 이메일로 접근한 경우
      if (
        type === "invite" ||
        data.user.user_metadata?.type === "store_invitation"
      ) {
        const storeId = data.user.user_metadata?.store_id;
        const tokenHash = token || data.user.user_metadata?.token_hash;

        console.log("초대 이메일 처리:", {
          type,
          storeId,
          tokenHash,
          redirectTo,
          userMetadata: data.user.user_metadata,
        });

        if (storeId && tokenHash) {
          // redirect_to 파라미터가 있으면 해당 URL로, 없으면 기본 패스워드 설정 페이지로
          if (redirectTo) {
            console.log("redirect_to로 리다이렉트:", redirectTo);
            return NextResponse.redirect(redirectTo);
          } else {
            const redirectPath =
              next || `/ko/invites/setup-password/${tokenHash}`;
            console.log("기본 경로로 리다이렉트:", redirectPath);
            return NextResponse.redirect(`${origin}${redirectPath}`);
          }
        }
      }

      // 일반 회원가입 사용자 (초대되지 않은 사용자)는 회원가입 완료 페이지로 리다이렉트
      // emailRedirectTo에서 locale 추출 시도
      const emailRedirectTo = redirectTo || next;
      const localeMatch = emailRedirectTo?.match(/\/(ko|en|ja)\//);
      const locale = localeMatch ? localeMatch[1] : "en";

      // 일반 사용자인 경우 회원가입 완료 페이지로 리다이렉트
      if (
        !data.user.user_metadata?.is_invited_user &&
        data.user.user_metadata?.type !== "store_invitation"
      ) {
        const signupCompletePath = `/${locale}/auth/signup-complete`;
        console.log(
          "일반 회원가입 사용자, 회원가입 완료 페이지로 리다이렉트:",
          signupCompletePath
        );

        const forwardedHost = request.headers.get("x-forwarded-host");
        const isLocalEnv = process.env.NODE_ENV === "development";

        if (isLocalEnv) {
          return NextResponse.redirect(`${origin}${signupCompletePath}`);
        } else if (forwardedHost) {
          return NextResponse.redirect(
            `https://${forwardedHost}${signupCompletePath}`
          );
        } else {
          return NextResponse.redirect(`${origin}${signupCompletePath}`);
        }
      }

      const forwardedHost = request.headers.get("x-forwarded-host"); // 배포 환경에서 원본 호스트
      const isLocalEnv = process.env.NODE_ENV === "development";

      if (isLocalEnv) {
        // 로컬 개발 환경
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        // 프로덕션 환경
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        // 기본값
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  // 인증 실패 시 에러 페이지로 리다이렉트
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
