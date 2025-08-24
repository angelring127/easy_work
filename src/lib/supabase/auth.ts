import { createClient } from "./server";
import { redirect } from "next/navigation";
import { User } from "@supabase/supabase-js";

// 서버에서 사용자 인증 상태 확인
export async function getUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error("사용자 인증 확인 중 오류:", error);
    return null;
  }

  return user;
}

// 인증된 사용자만 접근 가능한 페이지에서 사용
export async function requireAuth(): Promise<User> {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

// 특정 역할 권한 확인 (추후 확장 가능)
export async function checkUserRole(requiredRole: string): Promise<boolean> {
  const user = await getUser();

  if (!user) {
    return false;
  }

  // 현재는 기본 구조만 제공
  // 실제 역할 시스템은 데이터베이스 스키마에 따라 구현
  const userMetadata = user.user_metadata;
  const userRole = userMetadata?.role || "user";

  return userRole === requiredRole || userRole === "admin";
}

// 로그아웃 처리
export async function signOut() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error("로그아웃 중 오류가 발생했습니다.");
  }

  redirect("/login");
}
