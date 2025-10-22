import { createBrowserClient } from "@supabase/ssr";
import { Database } from "./types";

// 클라이언트 사이드에서 사용하는 Supabase 클라이언트 생성
export function createClient() {
  // 환경변수 검증 (빌드 시점에서는 기본값 사용)
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";

  return createBrowserClient<Database>(url, anonKey);
}
