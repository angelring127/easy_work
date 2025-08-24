import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// 로그아웃 API 엔드포인트
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  try {
    // 현재 세션 확인
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error("세션 확인 오류:", sessionError);
    }

    // 로그아웃 실행 (세션이 없어도 진행)
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("로그아웃 처리 중 오류:", error);
      return NextResponse.json(
        { 
          success: false,
          error: "로그아웃 중 오류가 발생했습니다.",
          code: error.message 
        },
        { status: 500 }
      );
    }

    // 성공 응답 (쿠키 삭제 포함)
    const response = NextResponse.json({ 
      success: true,
      message: "로그아웃이 완료되었습니다." 
    });

    // 인증 관련 쿠키 명시적 삭제
    response.cookies.delete('sb-access-token');
    response.cookies.delete('sb-refresh-token');
    
    return response;
  } catch (error) {
    console.error("로그아웃 API 오류:", error);
    return NextResponse.json(
      { 
        success: false,
        error: "서버 오류가 발생했습니다." 
      },
      { status: 500 }
    );
  }
}
