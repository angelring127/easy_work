import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { createClient } from "@/lib/supabase/server";

/**
 * 매장 구성원 목록 조회 API
 * GET /api/stores/[id]/users?role=&status=&q=&page=&limit=
 */
async function getStoreUsers(
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

    // 직접 테이블 조회 (뷰 제거로 인한 변경)
    const { data: userRoles, error: membersError } = await supabase
      .from("user_store_roles")
      .select("*")
      .eq("store_id", storeId)
      .is("deleted_at", null)
      .order("granted_at", { ascending: false });

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

    // 삭제된 사용자 정보도 포함하여 조회 (관리자용)
    const { data: allUserRoles, error: allRolesError } = await supabase
      .from("user_store_roles")
      .select("*")
      .eq("store_id", storeId)
      .order("granted_at", { ascending: false });

    if (allRolesError) {
      console.error("전체 사용자 역할 조회 오류:", allRolesError);
      return NextResponse.json(
        {
          success: false,
          error: "사용자 역할 조회에 실패했습니다",
        },
        { status: 500 }
      );
    }

    // 사용자 정보 조회 (이메일, 이름 등)
    const userIds = (userRoles || []).map((ur) => ur.user_id);
    const { data: users, error: usersError } =
      await supabase.auth.admin.listUsers();

    if (usersError) {
      console.error("사용자 정보 조회 오류:", usersError);
      return NextResponse.json(
        {
          success: false,
          error: "사용자 정보 조회에 실패했습니다",
        },
        { status: 500 }
      );
    }

    // 활성 사용자 정보에 실제 이메일/이름 추가
    const enrichedMembers = (userRoles || []).map((userRole) => {
      const user = users.users.find((u) => u.id === userRole.user_id);
      return {
        id: userRole.id,
        user_id: userRole.user_id,
        store_id: userRole.store_id,
        role: userRole.role,
        status: userRole.status,
        is_default_store: userRole.is_default_store,
        granted_at: userRole.granted_at,
        updated_at: userRole.updated_at,
        deleted_at: userRole.deleted_at,
        email: user?.email || "",
        name: user?.user_metadata?.name || null,
        avatar_url: user?.user_metadata?.avatar_url || null,
        user_created_at: user?.created_at || "",
        last_sign_in_at: user?.last_sign_in_at || null,
        temp_start_date: null,
        temp_end_date: null,
        temp_reason: null,
      };
    });

    // 삭제된 사용자 정보 추가
    const deletedRoles = (allUserRoles || []).filter(
      (role) => role.deleted_at !== null && role.deleted_at !== undefined
    );
    const deletedMembers = deletedRoles.map((role) => ({
      id: role.id,
      user_id: role.user_id,
      store_id: role.store_id,
      role: role.role,
      status: role.status,
      is_default_store: role.is_default_store,
      granted_at: role.granted_at,
      updated_at: role.updated_at,
      deleted_at: role.deleted_at,
      email: "", // 삭제된 사용자는 이메일 정보 없음
      name: null,
      avatar_url: null,
      user_created_at: "",
      last_sign_in_at: null,
      temp_start_date: null,
      temp_end_date: null,
      temp_reason: null,
    }));

    // 활성 사용자와 삭제된 사용자 결합
    let allMembers = [...enrichedMembers, ...deletedMembers];

    // 필터 적용 (클라이언트 사이드)
    if (role && role !== "all") {
      allMembers = allMembers.filter((member) => member.role === role);
    }
    if (status && status !== "all") {
      if (status === "DELETED") {
        // 삭제된 사용자 필터
        allMembers = allMembers.filter(
          (member) =>
            member.deleted_at !== null && member.deleted_at !== undefined
        );
      } else {
        // 일반 상태 필터 (삭제되지 않은 사용자만)
        allMembers = allMembers.filter(
          (member) =>
            member.status === status &&
            (member.deleted_at === null || member.deleted_at === undefined)
        );
      }
    }

    // 검색 필터 적용 (클라이언트 사이드)
    if (search) {
      const searchLower = search.toLowerCase();
      allMembers = allMembers.filter(
        (member) =>
          member.email?.toLowerCase().includes(searchLower) ||
          member.name?.toLowerCase().includes(searchLower)
      );
    }

    // 페이지네이션 적용 (클라이언트 사이드)
    const total = allMembers.length;
    const startIndex = offset;
    const endIndex = startIndex + limit;
    const paginatedMembers = allMembers.slice(startIndex, endIndex);

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
    console.error("매장 구성원 조회 API 오류:", error);
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
  return withAuth(async (req, context) => {
    return getStoreUsers(req, { ...context, params });
  })(request);
}
