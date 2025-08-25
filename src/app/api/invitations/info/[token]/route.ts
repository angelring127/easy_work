import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const supabase = await createClient();
    const { token } = await params;

    // 토큰으로 초대 정보 조회
    const { data: invitation, error: invitationError } = await supabase
      .from("invitations")
      .select(
        `
        *,
        stores!inner(
          id,
          name,
          timezone
        )
      `
      )
      .eq("token_hash", token)
      .eq("status", "PENDING")
      .single();

    if (invitationError || !invitation) {
      return NextResponse.json(
        {
          success: false,
          error: "초대 정보를 찾을 수 없습니다",
        },
        { status: 404 }
      );
    }

    // 만료 확인
    const now = new Date();
    const expiresAt = new Date(invitation.expires_at);

    if (now > expiresAt) {
      return NextResponse.json(
        {
          success: false,
          error: "초대가 만료되었습니다",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        invitation: {
          id: invitation.id,
          invited_email: invitation.invited_email,
          role_hint: invitation.role_hint,
          expires_at: invitation.expires_at,
          invited_by: invitation.invited_by,
        },
        store: {
          id: invitation.stores.id,
          name: invitation.stores.name,
          timezone: invitation.stores.timezone,
        },
      },
    });
  } catch (error) {
    console.error("초대 정보 조회 오류:", error);
    return NextResponse.json(
      {
        success: false,
        error: "초대 정보 조회 중 오류가 발생했습니다",
      },
      { status: 500 }
    );
  }
}
