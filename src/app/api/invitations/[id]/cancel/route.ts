import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { createClient } from "@/lib/supabase/server";

/**
 * 초대 취소 API
 * POST /api/invitations/[id]/cancel
 */
async function cancelInvitation(
  request: NextRequest,
  context: { user: any; params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { user } = context;
    const params = await context.params;
    const { id: invitationId } = params;
    const supabase = await createClient();

    // 초대 정보 조회
    const { data: invitation, error: fetchError } = await supabase
      .from("invitations")
      .select("*")
      .eq("id", invitationId)
      .single();

    if (fetchError || !invitation) {
      return NextResponse.json(
        {
          success: false,
          error: "초대를 찾을 수 없습니다",
        },
        { status: 404 }
      );
    }

    // 권한 확인: 매장 소유자 또는 서브 매니저만 취소 가능
    const { data: store } = await supabase
      .from("stores")
      .select("owner_id")
      .eq("id", invitation.store_id)
      .single();

    const isOwner = store?.owner_id === user.id;
    const { data: userRole } = await supabase
      .from("user_store_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("store_id", invitation.store_id)
      .eq("status", "ACTIVE")
      .single();

    const isSubManager = userRole?.role === "SUB_MANAGER";

    if (!isOwner && !isSubManager) {
      return NextResponse.json(
        {
          success: false,
          error: "초대 취소 권한이 없습니다",
        },
        { status: 403 }
      );
    }

    // 초대 상태 확인
    if (invitation.status !== "PENDING") {
      return NextResponse.json(
        {
          success: false,
          error: "대기 중인 초대만 취소할 수 있습니다",
        },
        { status: 400 }
      );
    }

    // 초대 취소
    const { error: updateError } = await supabase
      .from("invitations")
      .update({
        status: "CANCELLED",
        updated_at: new Date().toISOString(),
      })
      .eq("id", invitationId);

    if (updateError) {
      console.error("초대 취소 오류:", updateError);
      return NextResponse.json(
        {
          success: false,
          error: "초대 취소에 실패했습니다",
        },
        { status: 500 }
      );
    }

    // 감사 로그 기록
    try {
      await supabase.rpc("log_store_audit", {
        p_store_id: invitation.store_id,
        p_action: "CANCEL_INVITATION",
        p_table_name: "invitations",
        p_old_values: {
          id: invitationId,
          status: "PENDING",
        },
        p_new_values: {
          id: invitationId,
          status: "CANCELLED",
        },
      });
    } catch (auditError) {
      console.error("감사 로그 기록 실패:", auditError);
    }

    return NextResponse.json({
      success: true,
      message: "초대가 성공적으로 취소되었습니다",
    });
  } catch (error) {
    console.error("초대 취소 API 오류:", error);
    return NextResponse.json(
      {
        success: false,
        error: "서버 오류가 발생했습니다",
      },
      { status: 500 }
    );
  }
}

// Next.js 라우트 핸들러
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async (req, context) => {
    return cancelInvitation(req, { ...context, params });
  })(request);
}
