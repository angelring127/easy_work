import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

/**
 * 초대 수락 요청 스키마
 */
const acceptInviteSchema = z.object({
  token: z.string().min(1, "초대 토큰이 필요합니다"),
});

type AcceptInviteRequest = z.infer<typeof acceptInviteSchema>;

/**
 * 초대 수락 API
 * POST /api/invites/accept
 */
async function acceptInvite(
  request: NextRequest,
  context: { user: any }
): Promise<NextResponse> {
  try {
    const { user } = context;
    const supabase = await createClient();

    // 요청 데이터 검증
    const body = await request.json();
    const validatedData = acceptInviteSchema.parse(body);
    const { token } = validatedData;

    // 초대 토큰 조회 및 유효성 확인
    const { data: invite, error: inviteError } = await supabase
      .from("invites")
      .select(
        `
        *,
        store:stores(*)
      `
      )
      .eq("token", token)
      .eq("is_used", false)
      .eq("is_cancelled", false)
      .gte("expires_at", new Date().toISOString())
      .single();

    if (inviteError || !invite) {
      return NextResponse.json(
        {
          success: false,
          error: "유효하지 않거나 만료된 초대입니다",
        },
        { status: 404 }
      );
    }

    // 이메일 일치 확인
    if (invite.email !== user.email) {
      return NextResponse.json(
        {
          success: false,
          error: "초대된 이메일과 현재 로그인한 이메일이 일치하지 않습니다",
        },
        { status: 403 }
      );
    }

    // 이미 해당 매장의 구성원인지 확인
    const { data: existingMembership } = await supabase
      .from("store_users")
      .select("*")
      .eq("store_id", invite.store_id)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (existingMembership) {
      // 초대를 사용된 것으로 표시
      await supabase
        .from("invites")
        .update({
          is_used: true,
          accepted_at: new Date().toISOString(),
          accepted_by: user.id,
        })
        .eq("id", invite.id);

      return NextResponse.json(
        {
          success: false,
          error: "이미 해당 매장의 구성원입니다",
        },
        { status: 409 }
      );
    }

    // 트랜잭션 시작: 초대 수락 및 사용자-매장 관계 생성
    const updates = await Promise.all([
      // 1. 초대를 사용된 것으로 표시
      supabase
        .from("invites")
        .update({
          is_used: true,
          accepted_at: new Date().toISOString(),
          accepted_by: user.id,
        })
        .eq("id", invite.id),

      // 2. 사용자-매장 관계 생성
      supabase.from("store_users").insert({
        store_id: invite.store_id,
        user_id: user.id,
        role: invite.role,
        granted_by: invite.invited_by,
        is_active: true,
      }),
    ]);

    // 트랜잭션 결과 확인
    const [inviteUpdate, membershipInsert] = updates;

    if (inviteUpdate.error || membershipInsert.error) {
      console.error("초대 수락 오류:", {
        inviteUpdate: inviteUpdate.error,
        membershipInsert: membershipInsert.error,
      });

      return NextResponse.json(
        {
          success: false,
          error: "초대 수락 처리 중 오류가 발생했습니다",
        },
        { status: 500 }
      );
    }

    // 사용자 메타데이터 업데이트 (store_ids 배열에 추가)
    const currentUser = await supabase.auth.getUser();
    if (currentUser.data.user) {
      const currentStoreIds =
        currentUser.data.user.user_metadata?.store_ids || [];
      const updatedStoreIds = [
        ...new Set([...currentStoreIds, invite.store_id]),
      ];

      await supabase.auth.updateUser({
        data: {
          store_ids: updatedStoreIds,
        },
      });
    }

    // 성공 응답
    return NextResponse.json({
      success: true,
      data: {
        store: invite.store,
        role: invite.role,
        membership_id: null, // Supabase insert는 기본적으로 데이터를 반환하지 않음
      },
      message: `${invite.store.name}에 ${
        invite.role === "SUB_MANAGER" ? "서브 관리자" : "파트타이머"
      }로 성공적으로 합류했습니다`,
    });
  } catch (error) {
    console.error("초대 수락 API 오류:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "입력 데이터가 유효하지 않습니다",
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "서버 오류가 발생했습니다",
      },
      { status: 500 }
    );
  }
}

/**
 * 초대 정보 조회 API (토큰으로)
 * GET /api/invites/accept?token={token}
 */
async function getInviteInfo(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: "초대 토큰이 필요합니다",
        },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // 초대 정보 조회 (민감한 정보 제외)
    const { data: invite, error: inviteError } = await supabase
      .from("invites")
      .select(
        `
        id,
        email,
        role,
        invited_at,
        expires_at,
        is_used,
        is_cancelled,
        store:stores(id, name, description, address)
      `
      )
      .eq("token", token)
      .single();

    if (inviteError || !invite) {
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
    const expiresAt = new Date(invite.expires_at);
    const isExpired = now > expiresAt;

    let status = "valid";
    let statusMessage = "유효한 초대입니다";

    if (invite.is_cancelled) {
      status = "cancelled";
      statusMessage = "취소된 초대입니다";
    } else if (invite.is_used) {
      status = "used";
      statusMessage = "이미 사용된 초대입니다";
    } else if (isExpired) {
      status = "expired";
      statusMessage = "만료된 초대입니다";
    }

    return NextResponse.json({
      success: true,
      data: {
        ...invite,
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

// 인증된 사용자만 초대 수락 가능
export const POST = withAuth(acceptInvite);
// 초대 정보 조회는 인증 없이도 가능 (토큰으로 접근 제어)
export const GET = getInviteInfo;
