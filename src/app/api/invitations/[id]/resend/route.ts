import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { createClient } from "@/lib/supabase/server";
import { buildAbsoluteUrl } from "@/lib/env";

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

    // 기존 사용자 확인
    console.log("재발송 전 기존 사용자 확인:", invitation.invited_email);

    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === invitation.invited_email.toLowerCase()
    );

    // 기존 사용자가 있으면 삭제 후 새로 생성
    if (existingUser) {
      console.log("기존 사용자 삭제 중:", existingUser.email);

      const { error: deleteError } = await supabase.auth.admin.deleteUser(
        existingUser.id
      );

      if (deleteError) {
        console.error("기존 사용자 삭제 실패:", deleteError);
        return NextResponse.json(
          {
            success: false,
            error: "기존 사용자 삭제에 실패했습니다",
          },
          { status: 500 }
        );
      }

      console.log("기존 사용자 삭제 완료:", existingUser.email);

      // 삭제 확인 및 재시도
      let retryCount = 0;
      let stillExists = true;

      while (stillExists && retryCount < 3) {
        console.log(`삭제 확인 시도 ${retryCount + 1}/3`);

        // 잠시 대기
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const { data: checkUsers } = await supabase.auth.admin.listUsers();
        const existingUserCheck = checkUsers?.users?.find(
          (u) =>
            u.email?.toLowerCase() === invitation.invited_email.toLowerCase()
        );

        if (existingUserCheck) {
          console.log(
            "⚠️ 사용자 여전히 존재함, 재삭제 시도:",
            existingUserCheck.email
          );

          // 재삭제 시도
          const { error: retryDeleteError } =
            await supabase.auth.admin.deleteUser(existingUserCheck.id);

          if (retryDeleteError) {
            console.error("재삭제 실패:", retryDeleteError);
          } else {
            console.log("재삭제 성공");
          }

          retryCount++;
        } else {
          console.log("✅ 사용자 삭제 성공 - 더 이상 존재하지 않음");
          stillExists = false;
        }
      }

      if (stillExists) {
        console.error("❌ 사용자 삭제 실패 - 최대 재시도 횟수 초과");
        return NextResponse.json(
          {
            success: false,
            error: "사용자 삭제에 실패했습니다. 잠시 후 다시 시도해주세요.",
          },
          { status: 500 }
        );
      }
    }

    // 새 사용자 생성 및 이메일 발송
    try {
      console.log("새 사용자 생성 및 이메일 발송 시도:", {
        email: invitation.invited_email,
        isExistingUser: !!existingUser,
      });

      // 새 사용자 생성
      const { data: signUpData, error: signUpError } =
        await supabase.auth.admin.createUser({
          email: invitation.invited_email,
          password: "1q2w3e4r!", // 기본 패스워드
          email_confirm: true, // 이메일 자동 확인
          user_metadata: {
            store_id: invitation.store_id,
            store_name: (store as any)?.name || "Unknown Store",
            role_hint: invitation.role_hint,
            token_hash: invitation.token_hash,
            type: "store_invitation",
            invited_by: user.user_metadata?.name || user.email || "관리자",
            is_invited_user: true,
            needs_password_change: true,
          },
        });

      if (signUpError) {
        console.error("사용자 생성 실패:", signUpError);
        return NextResponse.json(
          {
            success: false,
            error: "사용자 생성에 실패했습니다",
          },
          { status: 500 }
        );
      }

      // 이메일 발송 (inviteUserByEmail 사용 - 더 확실함)
      console.log("inviteUserByEmail 호출:", {
        email: invitation.invited_email,
      });

      // 더 강력한 사용자 삭제 확인
      console.log("최종 사용자 삭제 확인 중...");
      const { data: finalCheck } = await supabase.auth.admin.listUsers();
      const finalUserCheck = finalCheck?.users?.find(
        (u) => u.email?.toLowerCase() === invitation.invited_email.toLowerCase()
      );

      if (finalUserCheck) {
        console.log("⚠️ 최종 확인: 사용자 여전히 존재함, 강제 삭제 시도");
        await supabase.auth.admin.deleteUser(finalUserCheck.id);
        // 삭제 후 잠시 대기
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } else {
        console.log("✅ 최종 확인: 사용자 삭제 완료");
      }

      const inviteRedirectUrl = buildAbsoluteUrl(
        `/ko/invites/verify-email?token=${invitation.token_hash}&type=invite`
      );

      // 이름이 없으면 이메일의 @ 앞부분을 기본값으로 사용
      const userName = invitation.invited_email.split("@")[0] || "";

      const { error: emailError } = await supabase.auth.admin.inviteUserByEmail(
        invitation.invited_email,
        {
          data: {
            store_id: invitation.store_id,
            store_name: (store as any)?.name || "Unknown Store",
            role_hint: invitation.role_hint,
            token_hash: invitation.token_hash,
            type: "store_invitation",
            invited_by: user.user_metadata?.name || user.email || "관리자",
            invited_name: userName, // 초대된 사용자 이름 추가
            is_invited_user: true,
          },
          redirectTo: inviteRedirectUrl,
        }
      );

      console.log("inviteUserByEmail 결과:", {
        error: emailError,
        success: !emailError,
      });

      if (emailError) {
        console.error("이메일 발송 실패:", emailError);

        // 이메일 발송 실패 시 사용자 삭제
        if (signUpData.user) {
          await supabase.auth.admin.deleteUser(signUpData.user.id);
        }

        // 더 구체적인 에러 메시지
        let errorMessage = "이메일 발송에 실패했습니다";
        if (emailError.message?.includes("already been registered")) {
          errorMessage = "이미 등록된 이메일입니다. 잠시 후 다시 시도해주세요.";
        }

        return NextResponse.json(
          {
            success: false,
            error: errorMessage,
          },
          { status: 500 }
        );
      }

      console.log("재발송 이메일 전송 성공:", {
        email: invitation.invited_email,
        storeName: (store as any)?.name,
        roleHint: invitation.role_hint,
        isExistingUser: !!existingUser,
        userId: signUpData.user?.id,
        redirectTo: inviteRedirectUrl,
      });

      console.log("📧 이메일 발송 완료 - 수신함을 확인해주세요!");
    } catch (emailError) {
      console.error("이메일 재발송 오류:", emailError);
      return NextResponse.json(
        {
          success: false,
          error: "이메일 재발송 중 오류가 발생했습니다",
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
