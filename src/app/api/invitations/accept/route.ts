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

    console.log("=== 초대 수락 API 시작 ===");
    console.log("초대 수락 API 호출:", {
      tokenHash,
      name,
      passwordLength: password.length,
      timestamp: new Date().toISOString(),
    });

    // 초대 정보 조회 (invitations 테이블 먼저 확인) - RLS 우회 함수 사용
    console.log("초대 정보 조회 시도:", { tokenHash });

    let { data: invitation, error: inviteError } = await supabase.rpc(
      "get_invitation_by_token",
      { p_token: tokenHash }
    );

    console.log("RPC 함수 호출 결과:", {
      invitation,
      inviteError,
      invitationType: typeof invitation,
      isArray: Array.isArray(invitation),
      length: invitation?.length,
    });

    // invitations 테이블에서 찾지 못한 경우 invites 테이블 확인
    if (inviteError || !invitation || invitation.length === 0) {
      console.log("invitations 테이블에서 찾지 못함, invites 테이블 확인:", {
        tokenHash,
      });

      // invites 테이블 조회 - RLS 우회 함수 사용
      const { data: oldInvite, error: oldInviteError } = await supabase.rpc(
        "get_invite_by_token",
        { p_token: tokenHash }
      );

      if (oldInvite && !oldInviteError && oldInvite.length > 0) {
        // invites 테이블에서 찾은 경우 invitations 형식으로 변환
        const oldInviteData = oldInvite[0]; // RPC 함수는 배열을 반환하므로 첫 번째 요소 사용

        // 사용된 초대나 취소된 초대는 제외
        if (oldInviteData.is_used || oldInviteData.is_cancelled) {
          console.log("사용되었거나 취소된 초대:", {
            is_used: oldInviteData.is_used,
            is_cancelled: oldInviteData.is_cancelled,
          });
        } else {
          invitation = {
            ...oldInviteData,
            invited_email: oldInviteData.email,
            role_hint: oldInviteData.role,
            token_hash: oldInviteData.token,
            status: "PENDING",
          };
          inviteError = null;
          console.log("invites 테이블에서 초대 찾음:", {
            id: oldInviteData.id,
          });
        }
      } else {
        console.log("invites 테이블에서도 찾지 못함:", {
          error: oldInviteError,
        });
      }
    } else {
      // invitations 테이블에서 찾은 경우
      if (Array.isArray(invitation) && invitation.length > 0) {
        invitation = invitation[0];
        inviteError = null;
        console.log("invitations 테이블에서 초대 찾음:", {
          id: invitation.id,
          token_hash: invitation.token_hash,
          token: invitation.token,
          isInvitesTable: invitation.token_hash === invitation.token,
        });
      } else {
        invitation = null;
        inviteError = new Error("초대 정보를 찾을 수 없습니다");
      }
    }

    console.log("초대 정보 조회 결과:", {
      invitation: invitation
        ? {
            id: invitation.id || invitation[0]?.id,
            status: invitation.status || invitation[0]?.status,
            expires_at: invitation.expires_at || invitation[0]?.expires_at,
            invited_email:
              invitation.invited_email || invitation[0]?.invited_email,
            token_hash: invitation.token_hash || invitation[0]?.token_hash,
            token: invitation.token || invitation[0]?.token,
            hasToken: !!(invitation.token || invitation[0]?.token),
            isInvitesTable:
              !!(invitation.token || invitation[0]?.token) &&
              (invitation.token_hash || invitation[0]?.token_hash) ===
                (invitation.token || invitation[0]?.token),
          }
        : null,
      error: inviteError,
      rawInvitation: invitation,
    });

    if (
      inviteError ||
      !invitation ||
      (Array.isArray(invitation) && invitation.length === 0)
    ) {
      console.log("초대 정보 조회 실패:", {
        inviteError,
        hasInvitation: !!invitation,
        isArray: Array.isArray(invitation),
        length: invitation?.length,
      });
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

    // 현재 로그인된 사용자 확인 (magiclink로 이미 로그인된 상태)
    const {
      data: { user: currentUser },
      error: userError,
    } = await supabase.auth.getUser();

    let authData;
    let signUpError;

    if (currentUser && currentUser.email === invitation.invited_email) {
      // 이미 로그인된 사용자 (magiclink 통해 로그인됨)
      console.log("이미 로그인된 사용자:", currentUser.email);
      console.log("사용자 메타데이터:", currentUser.user_metadata);
      authData = { user: currentUser, session: null };
    } else {
      // 사용자 정보 조회
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(
        (u) => u.email?.toLowerCase() === invitation.invited_email.toLowerCase()
      );

      if (existingUser) {
        // 기존 사용자: 비밀번호로 로그인 시도
        const { data: signInData, error: signInError } =
          await supabase.auth.signInWithPassword({
            email: invitation.invited_email,
            password,
          });

        if (signInError) {
          console.error("로그인 실패:", signInError);
          // 기본 패스워드로 실패했을 수도 있으므로 더 자세한 오류 제공
          return NextResponse.json(
            {
              success: false,
              error: `로그인 실패: ${signInError.message}. 기본 패스워드(1q2w3e4r!)로 시도해보세요.`,
            },
            { status: 400 }
          );
        }

        authData = { user: existingUser, session: signInData.session };
      } else {
        // 새 사용자: 회원가입 (거의 발생하지 않음)
        const { data: signUpData, error: signUpErr } =
          await supabase.auth.signUp({
            email: invitation.invited_email,
            password,
            options: {
              data: {
                name,
                role: invitation.role_hint,
              },
            },
          });

        authData = signUpData;
        signUpError = signUpErr;
      }
    }

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
    console.log("매장에 사용자 추가 시도:", {
      userId: authData.user.id,
      storeId: invitation.store_id,
      role: invitation.role_hint,
      invitedBy: invitation.invited_by,
      userEmail: authData.user.email,
    });

    const { data: userRoleId, error: roleError } = await supabase.rpc(
      "grant_user_role_by_invitation",
      {
        p_user_id: authData.user.id,
        p_store_id: invitation.store_id,
        p_role: invitation.role_hint,
        p_invited_by: invitation.invited_by,
      }
    );

    console.log("매장에 사용자 추가 결과:", {
      userRoleId,
      roleError,
      success: !roleError,
    });

    if (roleError) {
      console.error("매장 등록 상세 오류:", {
        message: roleError.message,
        details: roleError.details,
        hint: roleError.hint,
      });
    }

    // 3. 사용자 메타데이터에 패스워드 변경 필요 플래그 및 이름 추가
    const currentMetadata = authData.user.user_metadata || {};
    const updatedMetadata = {
      ...currentMetadata,
      name: name, // 초대 시 입력한 이름 추가
      needs_password_change: true,
      last_invitation_accepted: new Date().toISOString(),
    };

    const { error: metadataError } = await supabase.auth.updateUser({
      data: updatedMetadata,
    });

    if (metadataError) {
      console.error("사용자 메타데이터 업데이트 실패:", metadataError);
      // 메타데이터 업데이트 실패는 치명적이지 않으므로 계속 진행
    }

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

    // 매장 등록 확인
    console.log("매장 등록 성공 확인:", {
      userRoleId,
      userId: authData.user.id,
      storeId: invitation.store_id,
    });

    // 3. 초대 상태 업데이트 (invitations 또는 invites 테이블)
    let updateError = null;
    let updateResult = null;

    console.log("초대 상태 업데이트 시작:", {
      invitationId: invitation.id,
      tokenHash: invitation.token_hash,
      token: invitation.token,
      isInvitesTable: invitation.token_hash === invitation.token,
      invitationType: invitation.is_from_invites_table
        ? "invites"
        : "invitations",
      currentStatus: invitation.status,
      invitedEmail: invitation.invited_email,
      storeId: invitation.store_id,
    });

    // invites 테이블인지 확인 (token 필드가 있고 token_hash와 일치하는 경우)
    if (invitation.token && invitation.token_hash === invitation.token) {
      // invites 테이블의 초대인 경우
      console.log("invites 테이블 업데이트 시도:", {
        invitationId: invitation.id,
        email: invitation.invited_email,
        currentIsUsed: invitation.is_used,
      });

      const { data: invitesUpdateData, error: invitesUpdateError } =
        await supabase
          .from("invites")
          .update({
            is_used: true,
            accepted_at: new Date().toISOString(),
            accepted_by: authData.user.id,
          })
          .eq("id", invitation.id)
          .select();

      updateError = invitesUpdateError;
      updateResult = invitesUpdateData;
      console.log("invites 테이블 초대 상태 업데이트 결과:", {
        data: invitesUpdateData,
        error: invitesUpdateError,
        updatedRows: invitesUpdateData?.length || 0,
      });
    } else {
      // invitations 테이블의 초대인 경우 (RLS 우회 RPC 함수 사용)
      console.log("invitations 테이블 업데이트 시도 (RPC 함수 사용):", {
        invitationId: invitation.id,
        email: invitation.invited_email,
        currentStatus: invitation.status,
        tokenHash: invitation.token_hash,
        acceptedBy: authData.user.id,
        storeId: invitation.store_id,
      });

      // 업데이트 전 현재 상태 확인
      const { data: beforeUpdate } = await supabase
        .from("invitations")
        .select("status, accepted_at, accepted_by")
        .eq("id", invitation.id)
        .single();

      console.log("업데이트 전 초대 상태:", beforeUpdate);

      // RPC 함수를 사용하여 초대 상태 업데이트 (RLS 우회)
      const { data: rpcResult, error: rpcError } = await supabase.rpc(
        "accept_invitation",
        {
          p_invitation_id: invitation.id,
          p_accepted_by: authData.user.id,
          p_token_hash: invitation.token_hash,
        }
      );

      updateError = rpcError;
      updateResult = rpcResult;
      console.log("RPC 함수를 통한 초대 상태 업데이트 결과:", {
        result: rpcResult,
        error: rpcError,
        success: rpcResult === true,
        errorDetails: rpcError
          ? {
              message: rpcError.message,
              details: rpcError.details,
              hint: rpcError.hint,
              code: rpcError.code,
            }
          : null,
      });

      // 업데이트 후 상태 확인
      if (!rpcError && rpcResult === true) {
        const { data: afterUpdate } = await supabase
          .from("invitations")
          .select("status, accepted_at, accepted_by")
          .eq("id", invitation.id)
          .single();

        console.log("업데이트 후 초대 상태:", afterUpdate);
      }
    }

    if (updateError) {
      console.error("초대 상태 업데이트 실패:", updateError);
    } else {
      console.log("초대 상태 업데이트 성공:", {
        invitationId: invitation.id,
        status: "ACCEPTED",
        acceptedBy: authData.user.id,
        updatedRows: updateResult?.length || 0,
        tableType:
          invitation.token && invitation.token_hash === invitation.token
            ? "invites"
            : "invitations",
      });
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

    // 초대 상태 재확인 (업데이트 후)
    console.log("초대 상태 재확인 시작");
    console.log("재확인 대상 초대 정보:", {
      id: invitation.id,
      token: invitation.token,
      token_hash: invitation.token_hash,
      isInvitesTable: !!(
        invitation.token && invitation.token_hash === invitation.token
      ),
    });

    let finalStatus = null;

    if (invitation.token && invitation.token_hash === invitation.token) {
      // invites 테이블 재확인
      console.log("invites 테이블 재확인 시도");
      const { data: finalInvite, error: finalInviteError } = await supabase
        .from("invites")
        .select("is_used, accepted_at, accepted_by")
        .eq("id", invitation.id)
        .single();

      finalStatus = finalInvite;
      console.log("invites 테이블 최종 상태:", {
        data: finalInvite,
        error: finalInviteError,
      });
    } else {
      // invitations 테이블 재확인
      console.log("invitations 테이블 재확인 시도");
      const { data: finalInvitation, error: finalInvitationError } =
        await supabase
          .from("invitations")
          .select("status, accepted_at, accepted_by")
          .eq("id", invitation.id)
          .single();

      finalStatus = finalInvitation;
      console.log("invitations 테이블 최종 상태:", {
        data: finalInvitation,
        error: finalInvitationError,
      });
    }

    // 매장 정보 조회
    const { data: store } = await supabase
      .from("stores")
      .select("name")
      .eq("id", invitation.store_id)
      .single();

    console.log("=== 초대 수락 API 완료 ===");
    console.log("초대 수락 성공 응답:", {
      userId: authData.user.id,
      storeId: invitation.store_id,
      finalStatus: finalStatus,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      data: {
        userId: authData.user.id,
        userRoleId,
        storeId: invitation.store_id,
        storeName: store?.name,
        needsEmailConfirmation: !authData.session, // 세션이 없으면 이메일 확인 필요
        finalStatus: finalStatus, // 최종 상태 정보 포함
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
