import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { Database } from "./types";

// 서버 컴포넌트에서 사용하는 Supabase 클라이언트 (쿠키 기반 인증)
export async function createClient() {
  const cookieStore = await cookies();

  // 환경변수 검증
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Supabase URL과 SERVICE_ROLE_KEY가 환경변수에 설정되어야 합니다."
    );
  }

  return createServerClient<Database>(url, serviceKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // 서버 컴포넌트에서 호출된 경우 무시
          // 미들웨어에서 사용자 세션을 갱신하는 경우 이를 무시할 수 있습니다.
        }
      },
    },
  });
}

// 쿠키 없이 사용하는 순수 서버 클라이언트 (관리자 작업용)
export async function createPureClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Supabase URL과 SERVICE_ROLE_KEY가 환경변수에 설정되어야 합니다."
    );
  }

  return createServerClient<Database>(url, serviceKey, {
    cookies: {
      getAll() {
        return [];
      },
      setAll() {},
    },
  });
}
