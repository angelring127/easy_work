import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { createClient } from "@/lib/supabase/server";

/**
 * 보안 강화된 매장 구성원 목록 조회 API
 * GET /api/stores/[id]/members/secure
 *
 * 새로운 get_store_members() 함수를 사용하여
 * auth.users 데이터 노출 위험을 제거
 */
async function getSecureStoreMembers(
  request: NextRequest,
  context: { user: any; params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { user } = context;
    const params = await context.params;
    const storeId = params.id;
    const { searchParams } = new URL(request.url);

    // 쿼리 파라미터 파싱
    const role = searchParams.get("role");
    const status = searchParams.get("status");
    const search = searchParams.get("q");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    const supabase = await createClient();

    // 매장 접근 권한 확인
    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("*")
      .eq("id", storeId)
      .eq("status", "ACTIVE")
      .single();

    if (storeError || !store) {
      return NextResponse.json(
        {
          success: false,
          error: "매장을 찾을 수 없습니다",
        },
        { status: 404 }
      );
    }

    // 권한 확인: 매장 소유자 또는 서브 매니저만 접근 가능
    const isOwner = store.owner_id === user.id;
    const { data: userRole } = await supabase
      .from("user_store_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("store_id", storeId)
      .eq("status", "ACTIVE")
      .single();

    const isSubManager = userRole?.role === "SUB_MANAGER";

    if (!isOwner && !isSubManager) {
      return NextResponse.json(
        {
          success: false,
          error: "사용자 관리 권한이 없습니다",
        },
        { status: 403 }
      );
    }

    // 보안 강화된 함수를 사용하여 매장 구성원 조회
    const { data: members, error: membersError } = await supabase.rpc(
      "get_store_members",
      { p_store_id: storeId }
    );

    if (membersError) {
      console.error("매장 구성원 조회 오류:", membersError);
      return NextResponse.json(
        {
          success: false,
          error: "매장 구성원 조회에 실패했습니다",
        },
        { status: 500 }
      );
    }

    // 필터 적용 (클라이언트 사이드)
    let filteredMembers = members || [];

    if (role && role !== "all") {
      filteredMembers = filteredMembers.filter(
        (member) => member.role === role
      );
    }

    if (status && status !== "all") {
      filteredMembers = filteredMembers.filter(
        (member) => member.status === status
      );
    }

    // 검색 필터 적용 (클라이언트 사이드)
    if (search) {
      const searchLower = search.toLowerCase();
      filteredMembers = filteredMembers.filter(
        (member) =>
          member.email?.toLowerCase().includes(searchLower) ||
          member.name?.toLowerCase().includes(searchLower)
      );
    }

    // 페이지네이션 적용 (클라이언트 사이드)
    const total = filteredMembers.length;
    const startIndex = offset;
    const endIndex = startIndex + limit;
    const paginatedMembers = filteredMembers.slice(startIndex, endIndex);

    return NextResponse.json({
      success: true,
      data: {
        members: paginatedMembers,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("보안 강화된 매장 구성원 조회 API 오류:", error);
    return NextResponse.json(
      {
        success: false,
        error: "서버 오류가 발생했습니다",
      },
      { status: 500 }
    );
  }
}

// Next.js 동적 라우트 핸들러
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(getSecureStoreMembers)(request, { params });
}
