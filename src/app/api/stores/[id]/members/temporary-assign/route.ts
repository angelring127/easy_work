import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { createClient, createPureClient } from "@/lib/supabase/server";
import { z } from "zod";

// 요청 데이터 검증 스키마
const temporaryAssignmentSchema = z.object({
  userId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().optional(),
});

/**
 * 임시 근무 배치 API
 * POST /api/stores/[id]/members/temporary-assign
 */
async function assignTemporaryWork(
  request: NextRequest,
  context: { user: any; params: { id: string } }
): Promise<NextResponse> {
  try {
    const { user, params } = context;
    const storeId = params.id;
    const body = await request.json();

    // 요청 데이터 검증
    const validationResult = temporaryAssignmentSchema.safeParse(body);
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

    const { userId, startDate, endDate, reason } = validationResult.data;
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

    // 권한 확인: 매장 소유자만 임시 배치 가능
    if (store.owner_id !== user.id) {
      return NextResponse.json(
        {
          success: false,
          error: "임시 근무 배치 권한이 없습니다",
        },
        { status: 403 }
      );
    }

    // 대상 사용자 존재 확인 - Admin API 사용을 위해 Service Role Key 클라이언트 사용
    const adminClient = await createPureClient();
    const { data: targetUser, error: userError } =
      await adminClient.auth.admin.getUserById(userId);
    if (userError || !targetUser.user) {
      return NextResponse.json(
        {
          success: false,
          error: "사용자를 찾을 수 없습니다",
        },
        { status: 404 }
      );
    }

    // 날짜 유효성 검사
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (start < today) {
      return NextResponse.json(
        {
          success: false,
          error: "시작일은 오늘 이후여야 합니다",
        },
        { status: 400 }
      );
    }

    if (start >= end) {
      return NextResponse.json(
        {
          success: false,
          error: "시작일은 종료일보다 이전이어야 합니다",
        },
        { status: 400 }
      );
    }

    // 임시 근무 배치 함수 호출
    const { data: result, error: assignError } = await supabase.rpc(
      "assign_temporary_work",
      {
        p_user_id: userId,
        p_store_id: storeId,
        p_start_date: startDate,
        p_end_date: endDate,
        p_reason: reason,
        p_assigned_by: user.id,
      }
    );

    if (assignError) {
      console.error("임시 근무 배치 오류:", assignError);
      return NextResponse.json(
        {
          success: false,
          error: "임시 근무 배치에 실패했습니다",
        },
        { status: 500 }
      );
    }

    // 감사 로그 기록
    try {
      await supabase.rpc("log_store_audit", {
        p_store_id: storeId,
        p_action: "ASSIGN_TEMPORARY_WORK",
        p_table_name: "temporary_assignments",
        p_new_values: {
          user_id: userId,
          start_date: startDate,
          end_date: endDate,
          reason: reason,
          assigned_by: user.id,
        },
      });
    } catch (auditError) {
      console.error("감사 로그 기록 실패:", auditError);
    }

    return NextResponse.json({
      success: true,
      data: { assignmentId: result },
      message: "임시 근무가 성공적으로 배치되었습니다",
    });
  } catch (error) {
    console.error("임시 근무 배치 API 오류:", error);
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
    return assignTemporaryWork(req, { ...context, params: resolvedParams });
  })(request);
}
