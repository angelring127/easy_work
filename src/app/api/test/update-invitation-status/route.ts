import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { invitationId, status } = await request.json();

    if (!invitationId || !status) {
      return NextResponse.json(
        { success: false, error: "invitationId와 status가 필요합니다" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    console.log("수동 초대 상태 업데이트 시도:", {
      invitationId,
      status,
      timestamp: new Date().toISOString(),
    });

    // invitations 테이블에서 초대 찾기
    const { data: invitation, error: fetchError } = await supabase
      .from("invitations")
      .select("*")
      .eq("id", invitationId)
      .single();

    if (fetchError || !invitation) {
      console.error("초대를 찾을 수 없음:", fetchError);
      return NextResponse.json(
        { success: false, error: "초대를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    console.log("찾은 초대:", {
      id: invitation.id,
      email: invitation.invited_email,
      currentStatus: invitation.status,
      targetStatus: status,
    });

    // 상태 업데이트
    const { data: updateResult, error: updateError } = await supabase
      .from("invitations")
      .update({
        status: status,
        accepted_at: status === "ACCEPTED" ? new Date().toISOString() : null,
        accepted_by: status === "ACCEPTED" ? "manual-update" : null,
      })
      .eq("id", invitationId)
      .select();

    if (updateError) {
      console.error("상태 업데이트 실패:", updateError);
      return NextResponse.json(
        { success: false, error: "상태 업데이트에 실패했습니다" },
        { status: 500 }
      );
    }

    console.log("상태 업데이트 성공:", {
      invitationId,
      oldStatus: invitation.status,
      newStatus: status,
      updateResult,
    });

    return NextResponse.json({
      success: true,
      data: {
        invitationId,
        oldStatus: invitation.status,
        newStatus: status,
        updateResult,
      },
    });
  } catch (error) {
    console.error("수동 초대 상태 업데이트 오류:", error);
    return NextResponse.json(
      { success: false, error: "서버 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
