import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * 초대 정보 조회 API
 * GET /api/invitations/info?token={token}
 * GET /api/invitations/info?auth_token={supabase_auth_token}
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");
    const authToken = searchParams.get("auth_token");

    if (!token && !authToken) {
      return NextResponse.json(
        {
          success: false,
          error: "초대 토큰 또는 인증 토큰이 필요합니다",
        },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    let invitation = null;
    let inviteError = null;

    // 일반 토큰을 우선적으로 처리 (URL 파라미터 토큰)
    if (token) {
      console.log("일반 토큰으로 초대 정보 조회 시도:", { token });

      // 초대 정보 조회 (invitations 테이블 먼저 확인) - RLS 우회 함수 사용
      const { data: tokenInvitation, error: tokenInviteError } =
        await supabase.rpc("get_invitation_by_token", { p_token: token });

      // invitations 테이블에서 찾지 못한 경우 invites 테이블 확인
      if (
        tokenInviteError ||
        !tokenInvitation ||
        tokenInvitation.length === 0
      ) {
        console.log("invitations 테이블에서 찾지 못함, invites 테이블 확인:", {
          token,
        });

        // invites 테이블 조회 - RLS 우회 함수 사용
        const { data: oldInvite, error: oldInviteError } = await supabase.rpc(
          "get_invite_by_token",
          { p_token: token }
        );

        if (oldInvite && !oldInviteError && oldInvite.length > 0) {
          // invites 테이블에서 찾은 경우 invitations 형식으로 변환
          invitation = {
            id: oldInvite[0].id,
            store_id: oldInvite[0].store_id,
            invited_email: oldInvite[0].email,
            role_hint: oldInvite[0].role,
            token_hash: oldInvite[0].token,
            expires_at: oldInvite[0].expires_at,
            invited_by: oldInvite[0].invited_by,
            created_at: oldInvite[0].invited_at,
            store: null, // RPC 함수에서는 store 정보를 가져오지 않으므로 null
            status: oldInvite[0].is_used
              ? "ACCEPTED"
              : oldInvite[0].is_cancelled
              ? "CANCELLED"
              : "PENDING",
          };
          inviteError = null;
          console.log("invites 테이블에서 초대 찾음:", { id: oldInvite[0].id });
        } else {
          console.log("invites 테이블에서도 찾지 못함:", {
            error: oldInviteError,
          });
        }
      } else {
        invitation = tokenInvitation[0]; // RPC 함수는 배열을 반환하므로 첫 번째 요소 사용
        inviteError = tokenInviteError;
      }
    }

    // 일반 토큰으로 찾지 못한 경우에만 Supabase 인증 토큰 처리
    if (!invitation && authToken) {
      console.log("Supabase 인증 토큰으로 초대 정보 조회 시도:", {
        authToken: authToken.substring(0, 20) + "...",
      });

      try {
        // 인증 토큰으로 세션 설정
        const { data: sessionData, error: sessionError } =
          await supabase.auth.setSession({
            access_token: authToken,
            refresh_token: "",
          });

        if (sessionError) {
          console.log("인증 토큰 세션 설정 실패:", sessionError);
        } else if (sessionData.user) {
          console.log("인증 토큰 세션 설정 성공:", sessionData.user.email);

          // 사용자 메타데이터에서 초대 정보 확인
          const userMetadata = sessionData.user.user_metadata;
          if (userMetadata?.token_hash) {
            console.log(
              "사용자 메타데이터에서 토큰 해시 발견:",
              userMetadata.token_hash
            );

            // 토큰 해시로 초대 정보 조회 - RLS 우회 함수 사용
            const { data: metaInvitation, error: metaError } =
              await supabase.rpc("get_invitation_by_token", {
                p_token: userMetadata.token_hash,
              });

            if (metaInvitation && !metaError && metaInvitation.length > 0) {
              invitation = metaInvitation[0]; // RPC 함수는 배열을 반환하므로 첫 번째 요소 사용
              inviteError = null;
              console.log("메타데이터 토큰으로 초대 찾음:", {
                id: metaInvitation[0].id,
              });
            } else {
              // invites 테이블에서도 확인 - RLS 우회 함수 사용
              const { data: oldMetaInvite, error: oldMetaError } =
                await supabase.rpc("get_invite_by_token", {
                  p_token: userMetadata.token_hash,
                });

              if (oldMetaInvite && !oldMetaError && oldMetaInvite.length > 0) {
                invitation = {
                  id: oldMetaInvite[0].id,
                  store_id: oldMetaInvite[0].store_id,
                  invited_email: oldMetaInvite[0].email,
                  role_hint: oldMetaInvite[0].role,
                  token_hash: oldMetaInvite[0].token,
                  expires_at: oldMetaInvite[0].expires_at,
                  invited_by: oldMetaInvite[0].invited_by,
                  created_at: oldMetaInvite[0].invited_at,
                  store: null, // RPC 함수에서는 store 정보를 가져오지 않으므로 null
                  status: oldMetaInvite[0].is_used
                    ? "ACCEPTED"
                    : oldMetaInvite[0].is_cancelled
                    ? "CANCELLED"
                    : "PENDING",
                };
                inviteError = null;
                console.log(
                  "메타데이터 토큰으로 invites 테이블에서 초대 찾음:",
                  { id: oldMetaInvite[0].id }
                );
              }
            }
          }
        }
      } catch (error) {
        console.log("인증 토큰 처리 중 오류:", error);
      }
    }

    if (inviteError || !invitation) {
      console.log("초대 정보 조회 실패:", {
        token,
        authToken: authToken ? authToken.substring(0, 20) + "..." : null,
        error: inviteError,
        invitation: invitation ? "found" : "not found",
      });

      return NextResponse.json(
        {
          success: false,
          error: "초대를 찾을 수 없습니다",
        },
        { status: 404 }
      );
    }

    // 초대 상태 확인
    const now = new Date();
    const expiresAt = new Date(invitation.expires_at);
    const isExpired = now > expiresAt;

    let status = "valid";
    let statusMessage = "유효한 초대입니다";

    if (invitation.status === "CANCELLED") {
      status = "cancelled";
      statusMessage = "취소된 초대입니다";
    } else if (invitation.status === "ACCEPTED") {
      status = "accepted";
      statusMessage = "이미 수락된 초대입니다";
    } else if (isExpired) {
      status = "expired";
      statusMessage = "만료된 초대입니다";
    }

    return NextResponse.json({
      success: true,
      data: {
        ...invitation,
        status,
        statusMessage,
        isValid: status === "valid",
      },
    });
  } catch (error) {
    console.error("초대 정보 조회 API 오류:", error);
    return NextResponse.json(
      {
        success: false,
        error: "서버 오류가 발생했습니다",
      },
      { status: 500 }
    );
  }
}
