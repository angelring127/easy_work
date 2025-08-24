import { createBrowserClient } from "@supabase/ssr";
import { Database } from "./types";

// 클라이언트 사이드에서 사용하는 Supabase 클라이언트 생성
export function createClient() {
  // 환경변수 검증
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase URL과 ANON KEY가 환경변수에 설정되어야 합니다.");
  }

  return createBrowserClient<Database>(url, anonKey);
}
