import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

const INVALID_REFRESH_TOKEN_MESSAGES = [
  "Invalid Refresh Token",
  "Refresh Token Not Found",
];

export function isInvalidRefreshTokenError(error: unknown): boolean {
  if (!error) {
    return false;
  }

  const message = error instanceof Error ? error.message : String(error);

  return INVALID_REFRESH_TOKEN_MESSAGES.some((tokenErrorMessage) =>
    message.includes(tokenErrorMessage)
  );
}

export async function clearLocalSupabaseSession(
  supabase: Pick<SupabaseClient<Database>, "auth">
): Promise<void> {
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // 이미 손상된 세션 정리 중인 경우 추가 오류는 무시한다.
  }
}
