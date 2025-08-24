import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

// 요청 데이터 검증 스키마
const revokeRoleSchema = z.object({
  userId: z.string().uuid(),
});

/**
 * 사용자 역할 회수 API
 * POST /api/stores/[id]/roles/revoke
 */
async function revokeUserRole(
  request: NextRequest,
  context: { user: any; params: { id: string } }
): Promise<NextResponse> {
  try {
    const { user, params } = context;
    const storeId = params.id;
    const body = await request.json();

    // 요청 데이터 검증
    const validationResult = revokeRoleSchema.safeParse(body);
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

    const { userId } = validationResult.data;
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

    // 권한 확인: 매장 소유자만 역할 회수 가능
    if (store.owner_id !== user.id) {
      return NextResponse.json(
        {
          success: false,
          error: "역할 회수 권한이 없습니다",
        },
        { status: 403 }
      );
    }

    // 대상 사용자의 현재 역할 확인
    const { data: currentRole, error: roleError } = await supabase
      .from("user_store_roles")
      .select("role, status")
      .eq("user_id", userId)
      .eq("store_id", storeId)
      .single();

    if (roleError || !currentRole) {
      return NextResponse.json(
        {
          success: false,
          error: "사용자의 역할을 찾을 수 없습니다",
        },
        { status: 404 }
      );
    }

    if (currentRole.status === "INACTIVE") {
      return NextResponse.json(
        {
          success: false,
          error: "이미 비활성화된 사용자입니다",
        },
        { status: 400 }
      );
    }

    // 역할 회수 함수 호출
    const { data: result, error: revokeError } = await supabase.rpc(
      "revoke_user_role",
      {
        p_user_id: userId,
        p_store_id: storeId,
        p_revoked_by: user.id,
      }
    );

    if (revokeError) {
      console.error("역할 회수 오류:", revokeError);
      return NextResponse.json(
        {
          success: false,
          error: "역할 회수에 실패했습니다",
        },
        { status: 500 }
      );
    }

    // 감사 로그 기록
    try {
      await supabase.rpc("log_store_audit", {
        p_store_id: storeId,
        p_action: "REVOKE_ROLE",
        p_table_name: "user_store_roles",
        p_old_values: {
          user_id: userId,
          role: currentRole.role,
          status: currentRole.status,
        },
        p_new_values: {
          user_id: userId,
          role: currentRole.role,
          status: "INACTIVE",
          revoked_by: user.id,
        },
      });
    } catch (auditError) {
      console.error("감사 로그 기록 실패:", auditError);
    }

    return NextResponse.json({
      success: true,
      data: { revoked: result },
      message: "역할이 성공적으로 회수되었습니다",
    });
  } catch (error) {
    console.error("역할 회수 API 오류:", error);
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
    return revokeUserRole(req, { ...context, params: resolvedParams });
  })(request);
}
