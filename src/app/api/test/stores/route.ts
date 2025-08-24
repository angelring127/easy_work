import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * 매장 관련 테스트 API
 * GET /api/test/stores
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 1. 현재 사용자 정보 확인
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "사용자 인증 실패",
          details: userError,
        },
        { status: 401 }
      );
    }

    // 2. 사용자가 소유한 매장만 조회 (RLS 정책 준수)
    const { data: stores, error: storesError } = await supabase
      .from("stores")
      .select("*")
      .eq("owner_id", user.id)
      .limit(5);

    // 3. store_users 테이블 존재 확인 (오류 무시)
    let storeUsers = null;
    let storeUsersError = null;
    try {
      const result = await supabase.from("store_users").select("*").limit(5);
      storeUsers = result.data;
      storeUsersError = result.error;
    } catch (error) {
      storeUsersError = error;
    }

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.user_metadata?.role || "unknown",
        },
        stores: {
          data: stores,
          error: storesError,
          count: stores?.length || 0,
        },
        storeUsers: {
          data: storeUsers,
          error: storeUsersError,
          count: storeUsers?.length || 0,
        },
      },
    });
  } catch (error) {
    console.error("테스트 API 오류:", error);
    return NextResponse.json(
      {
        success: false,
        error: "테스트 API 오류",
        details: error,
      },
      { status: 500 }
    );
  }
}
