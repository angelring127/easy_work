import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { createClient } from "@/lib/supabase/server";

/**
 * 초대 재발송 API
 * POST /api/invitations/[id]/resend
 */
async function resendInvitation(
  request: NextRequest,
  context: { user: any; params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { user } = context;
    const params = await context.params;
    const { id: invitationId } = params;
    console.log("초대 재발송 요청:", { invitationId, userId: user.id });
    const supabase = await createClient();

    // 초대 정보 조회
    const { data: invitation, error: fetchError } = await supabase
      .from("invitations")
      .select("*")
      .eq("id", invitationId)
      .single();

    if (fetchError || !invitation) {
      console.error("초대 정보 조회 실패:", { fetchError, invitationId });
      return NextResponse.json(
        {
          success: false,
          error: "초대를 찾을 수 없습니다",
          details: fetchError?.message,
        },
        { status: 404 }
      );
    }

    console.log("초대 정보 조회 성공:", invitation);

    // 권한 확인: 매장 소유자 또는 서브 매니저만 재발송 가능
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

    console.log("권한 확인:", {
      userId: user.id,
      storeOwnerId: store?.owner_id,
      isOwner,
      userRole: userRole?.role,
      isSubManager,
    });

    if (!isOwner && !isSubManager) {
      console.error("권한 없음:", { isOwner, isSubManager, userRole });
      return NextResponse.json(
        {
          success: false,
          error: "초대 재발송 권한이 없습니다",
        },
        { status: 403 }
      );
    }

    // 초대 상태 확인
    if (invitation.status !== "PENDING") {
      return NextResponse.json(
        {
          success: false,
          error: "대기 중인 초대만 재발송할 수 있습니다",
        },
        { status: 400 }
      );
    }

    // 만료 시간 갱신 (7일 연장)
    const { error: updateError } = await supabase
      .from("invitations")
      .update({
        expires_at: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000
        ).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", invitationId);

    if (updateError) {
      console.error("초대 재발송 오류:", updateError);
      return NextResponse.json(
        {
          success: false,
          error: "초대 재발송에 실패했습니다",
        },
        { status: 500 }
      );
    }

    // 감사 로그 기록
    try {
      await supabase.rpc("log_store_audit", {
        p_store_id: invitation.store_id,
        p_action: "RESEND_INVITATION",
        p_table_name: "invitations",
        p_old_values: {
          id: invitationId,
          expires_at: invitation.expires_at,
        },
        p_new_values: {
          id: invitationId,
          expires_at: new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000
          ).toISOString(),
        },
      });
    } catch (auditError) {
      console.error("감사 로그 기록 실패:", auditError);
    }

    return NextResponse.json({
      success: true,
      message: "초대가 성공적으로 재발송되었습니다",
    });
  } catch (error) {
    console.error("초대 재발송 API 오류:", error);
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
    return resendInvitation(req, { ...context, params });
  })(request);
}
