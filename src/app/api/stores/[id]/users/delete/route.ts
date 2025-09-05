import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

// 요청 데이터 검증 스키마
const deleteUserSchema = z.object({
  userId: z.string().uuid(),
});

/**
 * 사용자 소프트 삭제 API (스케줄 이력 보존)
 * POST /api/stores/[id]/users/delete
 */
async function deleteUser(
  request: NextRequest,
  context: { user: any; params: { id: string } }
): Promise<NextResponse> {
  try {
    const { user, params } = context;
    const storeId = params.id;
    const body = await request.json();

    // 요청 데이터 검증
    const validationResult = deleteUserSchema.safeParse(body);
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

    // 권한 확인: 매장 소유자만 사용자 삭제 가능
    if (store.owner_id !== user.id) {
      return NextResponse.json(
        {
          success: false,
          error: "사용자 삭제 권한이 없습니다",
        },
        { status: 403 }
      );
    }

    // 자기 자신을 삭제하려는 경우 방지
    if (userId === user.id) {
      return NextResponse.json(
        {
          success: false,
          error: "자기 자신을 삭제할 수 없습니다",
        },
        { status: 400 }
      );
    }

    // 대상 사용자의 현재 상태 확인
    const { data: currentUser, error: userError } = await supabase
      .from("user_store_roles")
      .select("role, status, deleted_at")
      .eq("user_id", userId)
      .eq("store_id", storeId)
      .single();
    // 마스터 권한을 가진 사용자는 삭제 불가
    if (currentUser.role === "MASTER") {
      return NextResponse.json(
        {
          success: false,
          error: "마스터 권한을 가진 사용자는 삭제할 수 없습니다",
        },
        { status: 400 }
      );
    }

    if (userError || !currentUser) {
      return NextResponse.json(
        {
          success: false,
          error: "사용자를 찾을 수 없습니다",
        },
        { status: 404 }
      );
    }

    if (currentUser.deleted_at) {
      return NextResponse.json(
        {
          success: false,
          error: "이미 삭제된 사용자입니다",
        },
        { status: 400 }
      );
    }

    // 사용자 소프트 삭제 (스케줄 이력은 보존)
    const { data: result, error: deleteError } = await supabase.rpc(
      "soft_delete_user",
      {
        p_user_id: userId,
        p_store_id: storeId,
        p_deleted_by: user.id,
      }
    );

    if (deleteError) {
      console.error("사용자 삭제 오류:", deleteError);
      return NextResponse.json(
        {
          success: false,
          error: "사용자 삭제에 실패했습니다",
        },
        { status: 500 }
      );
    }

    // 감사 로그 기록
    try {
      await supabase.rpc("log_store_audit", {
        p_store_id: storeId,
        p_action: "DELETE_USER",
        p_table_name: "user_store_roles",
        p_old_values: {
          user_id: userId,
          role: currentUser.role,
          status: currentUser.status,
        },
        p_new_values: {
          user_id: userId,
          role: currentUser.role,
          status: currentUser.status,
          deleted_at: new Date().toISOString(),
          deleted_by: user.id,
        },
      });
    } catch (auditError) {
      console.error("감사 로그 기록 실패:", auditError);
    }

    return NextResponse.json({
      success: true,
      data: { deleted: result },
      message: "사용자가 성공적으로 삭제되었습니다. 스케줄 이력은 보존됩니다.",
    });
  } catch (error) {
    console.error("사용자 삭제 API 오류:", error);
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
    return deleteUser(req, { ...context, params: resolvedParams });
  })(request);
}
