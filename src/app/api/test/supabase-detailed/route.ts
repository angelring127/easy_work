import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// 더 상세한 Supabase 연결 및 기능 테스트
export async function GET() {
  try {
    const supabase = await createClient();

    // 1. 인증 상태 확인
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    // 2. 데이터베이스 메타데이터 확인 (public 스키마의 테이블 목록)
    const { data: tables, error: tablesError } = await supabase
      .from("information_schema.tables")
      .select("table_name")
      .eq("table_schema", "public")
      .limit(5);

    // 3. Supabase 프로젝트 설정 확인
    const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const projectRef = projectUrl?.split("//")[1]?.split(".")[0];

    return NextResponse.json({
      success: true,
      message: "Supabase 연결 상세 테스트 완료",
      data: {
        projectReference: projectRef,
        authStatus: {
          hasUser: !!user,
          userId: user?.id || null,
          authError: authError?.message || null,
        },
        database: {
          tablesFound: tables?.length || 0,
          tablesList: tables?.map((t: any) => t.table_name) || [],
          tablesError: tablesError?.message || null,
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("상세 Supabase 테스트 중 오류:", error);
    return NextResponse.json(
      {
        success: false,
        error: "상세 테스트 중 예상치 못한 오류가 발생했습니다",
        details: error instanceof Error ? error.message : "알 수 없는 오류",
      },
      { status: 500 }
    );
  }
}
