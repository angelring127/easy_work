import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

// 요청 데이터 검증 스키마
const acceptInvitationSchema = z.object({
  tokenHash: z.string().min(1),
  name: z.string().min(1, "이름을 입력해주세요"),
  password: z.string().min(8, "비밀번호는 최소 8자 이상이어야 합니다"),
});

/**
 * 초대 수락 API (회원가입 + 매장 추가)
 * POST /api/invitations/accept
 */
async function acceptInvitation(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();

    // 요청 데이터 검증
    const validationResult = acceptInvitationSchema.safeParse(body);
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

    const { tokenHash, name, password } = validationResult.data;
    const supabase = await createClient();

    // 초대 정보 조회
    const { data: invitation, error: inviteError } = await supabase
      .from("invitations")
      .select("*")
      .eq("token_hash", tokenHash)
      .eq("status", "PENDING")
      .single();

    if (inviteError || !invitation) {
      return NextResponse.json(
        {
          success: false,
          error: "유효하지 않거나 만료된 초대입니다",
        },
        { status: 400 }
      );
    }

    // 만료 시간 확인
    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json(
        {
          success: false,
          error: "만료된 초대입니다",
        },
        { status: 400 }
      );
    }

    // 1. 사용자 회원가입
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: invitation.invited_email,
      password,
      options: {
        data: {
          name,
          role: invitation.role_hint,
        },
      },
    });

    if (signUpError) {
      console.error("회원가입 실패:", signUpError);
      return NextResponse.json(
        {
          success: false,
          error: "회원가입에 실패했습니다",
          details: signUpError.message,
        },
        { status: 400 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        {
          success: false,
          error: "사용자 생성에 실패했습니다",
        },
        { status: 500 }
      );
    }

    // 2. 매장에 사용자 추가
    const { data: userRoleId, error: roleError } = await supabase.rpc(
      "grant_user_role",
      {
        p_user_id: authData.user.id,
        p_store_id: invitation.store_id,
        p_role: invitation.role_hint,
        p_granted_by: invitation.invited_by,
      }
    );

    if (roleError) {
      console.error("매장 추가 실패:", roleError);
      return NextResponse.json(
        {
          success: false,
          error: "매장 추가에 실패했습니다",
          details: roleError.message,
        },
        { status: 500 }
      );
    }

    // 3. 초대 상태 업데이트
    const { error: updateError } = await supabase
      .from("invitations")
      .update({
        status: "ACCEPTED",
        accepted_at: new Date().toISOString(),
        accepted_by: authData.user.id,
      })
      .eq("id", invitation.id);

    if (updateError) {
      console.error("초대 상태 업데이트 실패:", updateError);
    }

    // 감사 로그 기록
    try {
      await supabase.rpc("log_store_audit", {
        p_store_id: invitation.store_id,
        p_action: "ACCEPT_INVITATION",
        p_table_name: "invitations",
        p_old_values: {
          token_hash: tokenHash,
          status: "PENDING",
        },
        p_new_values: {
          token_hash: tokenHash,
          status: "ACCEPTED",
          accepted_by: authData.user.id,
        },
      });
    } catch (auditError) {
      console.error("감사 로그 기록 실패:", auditError);
    }

    // 매장 정보 조회
    const { data: store } = await supabase
      .from("stores")
      .select("name")
      .eq("id", invitation.store_id)
      .single();

    return NextResponse.json({
      success: true,
      data: {
        userId: authData.user.id,
        userRoleId,
        storeId: invitation.store_id,
        storeName: store?.name,
        needsEmailConfirmation: !authData.session, // 세션이 없으면 이메일 확인 필요
      },
      message: "초대가 성공적으로 수락되었습니다",
    });
  } catch (error) {
    console.error("초대 수락 API 오류:", error);
    return NextResponse.json(
      {
        success: false,
        error: "서버 오류가 발생했습니다",
      },
      { status: 500 }
    );
  }
}

// Next.js 라우트 핸들러 (인증 불필요 - 새 사용자가 회원가입하는 과정)
export async function POST(request: NextRequest) {
  return acceptInvitation(request);
}
