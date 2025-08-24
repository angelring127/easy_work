import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

// 요청 데이터 검증 스키마
const grantRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["SUB_MANAGER", "PART_TIMER"]),
});

/**
 * 사용자 역할 부여 API
 * POST /api/stores/[id]/roles/grant
 */
async function grantUserRole(
  request: NextRequest,
  context: { user: any; params: { id: string } }
): Promise<NextResponse> {
  try {
    const { user, params } = context;
    const storeId = params.id;
    const body = await request.json();

    // 요청 데이터 검증
    const validationResult = grantRoleSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "잘못된 요청 데이터입니다",
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { userId, role } = validationResult.data;
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

    // 권한 확인: 매장 소유자만 역할 부여 가능
    if (store.owner_id !== user.id) {
      return NextResponse.json(
        {
          success: false,
          error: "역할 부여 권한이 없습니다",
        },
        { status: 403 }
      );
    }

    // 대상 사용자 존재 확인
    const { data: targetUser, error: userError } =
      await supabase.auth.admin.getUserById(userId);
    if (userError || !targetUser.user) {
      return NextResponse.json(
        {
          success: false,
          error: "사용자를 찾을 수 없습니다",
        },
        { status: 404 }
      );
    }

    // 역할 부여 함수 호출
    const { data: result, error: grantError } = await supabase.rpc(
      "grant_user_role",
      {
        p_user_id: userId,
        p_store_id: storeId,
        p_role: role,
        p_granted_by: user.id,
      }
    );

    if (grantError) {
      console.error("역할 부여 오류:", grantError);
      return NextResponse.json(
        {
          success: false,
          error: "역할 부여에 실패했습니다",
        },
        { status: 500 }
      );
    }

    // 감사 로그 기록
    try {
      await supabase.rpc("log_store_audit", {
        p_store_id: storeId,
        p_action: "GRANT_ROLE",
        p_table_name: "user_store_roles",
        p_new_values: {
          user_id: userId,
          role: role,
          granted_by: user.id,
        },
      });
    } catch (auditError) {
      console.error("감사 로그 기록 실패:", auditError);
    }

    return NextResponse.json({
      success: true,
      data: { roleId: result },
      message: "역할이 성공적으로 부여되었습니다",
    });
  } catch (error) {
    console.error("역할 부여 API 오류:", error);
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
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  return withAuth(async (req, context) => {
    return grantUserRole(req, { ...context, params: resolvedParams });
  })(request);
}
