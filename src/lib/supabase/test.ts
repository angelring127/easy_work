import { createClient as createBrowserClient } from "./client";
import { createClient as createServerClient } from "./server";

// 브라우저 클라이언트 연결 테스트
export async function testBrowserConnection(): Promise<boolean> {
  try {
    const supabase = createBrowserClient();
    const { data, error } = await supabase
      .from("nonexistent_table")
      .select("*")
      .limit(1);

    // 테이블이 존재하지 않아도 연결 자체는 성공해야 함
    // 일반적으로 "relation does not exist" 오류가 발생
    if (error && error.message.includes("relation")) {
      return true; // 연결은 성공, 테이블만 없음
    }

    return !error;
  } catch (error) {
    console.error("브라우저 클라이언트 연결 테스트 실패:", error);
    return false;
  }
}

// 서버 클라이언트 연결 테스트
export async function testServerConnection(): Promise<{
  success: boolean;
  error?: string;
  details?: any;
}> {
  try {
    const supabase = await createServerClient();

    // 더 간단한 연결 테스트 - auth 상태 확인
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("Auth 테스트 중 오류:", authError);
      // Auth 오류는 연결 문제가 아닐 수 있음
    }

    // 기본 연결 테스트 - 존재하지 않는 테이블 쿼리
    const { data, error } = await supabase
      .from("nonexistent_table")
      .select("*")
      .limit(1);

    // 테이블이 존재하지 않아도 연결 자체는 성공해야 함
    if (error) {
      // PostgREST 에러 코드들 - 연결은 성공했지만 테이블/스키마 문제
      const connectionSuccessCodes = ["PGRST205", "42P01"]; // 테이블 없음, relation does not exist
      const isConnectionSuccess =
        connectionSuccessCodes.some((code) => error.code === code) ||
        error.message.includes("relation") ||
        error.message.includes("table") ||
        error.message.includes("schema cache");

      if (isConnectionSuccess) {
        return { success: true }; // 연결은 성공, 테이블만 없음
      }

      console.error("연결 테스트 오류:", error);
      return {
        success: false,
        error: error.message,
        details: error,
      };
    }

    return { success: true };
  } catch (error) {
    console.error("서버 클라이언트 연결 테스트 실패:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류",
      details: error,
    };
  }
}

// 환경변수 검증
export function validateEnvironmentVariables(): {
  isValid: boolean;
  missingVars: string[];
} {
  const requiredVars = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];

  const missingVars = requiredVars.filter((varName) => !process.env[varName]);

  return {
    isValid: missingVars.length === 0,
    missingVars,
  };
}
