import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// OAuth 콜백 처리 (Google, GitHub 등 소셜 로그인용)
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
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
