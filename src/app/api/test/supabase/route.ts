import { NextResponse } from "next/server";
import {
  testServerConnection,
  validateEnvironmentVariables,
} from "@/lib/supabase/test";

// Supabase 연결 테스트 API 엔드포인트
export async function GET() {
  try {
    // 환경변수 검증
    const { isValid, missingVars } = validateEnvironmentVariables();

    if (!isValid) {
      return NextResponse.json(
        {
          success: false,
          error: "환경변수가 누락되었습니다",
          missingVars,
        },
        { status: 400 }
      );
    }

    // 서버 연결 테스트
    const connectionResult = await testServerConnection();

    if (!connectionResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Supabase 서버 연결에 실패했습니다",
          details: connectionResult.error,
          debugInfo: connectionResult.details,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Supabase 연결이 성공적으로 설정되었습니다",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Supabase 테스트 중 오류:", error);
    return NextResponse.json(
      {
        success: false,
        error: "테스트 중 예상치 못한 오류가 발생했습니다",
      },
      { status: 500 }
    );
  }
}
