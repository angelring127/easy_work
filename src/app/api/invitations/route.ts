import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

// 요청 데이터 검증 스키마
const createInvitationSchema = z.object({
  storeId: z.string().uuid(),
  email: z.string().email(),
  roleHint: z
    .enum(["PART_TIMER", "SUB_MANAGER"])
    .optional()
    .default("PART_TIMER"),
  expiresInDays: z.number().min(1).max(30).optional().default(7),
});

/**
 * 초대 생성 API
 * POST /api/invitations
 */
async function createInvitation(
  request: NextRequest,
  context: { user: any }
): Promise<NextResponse> {
  try {
    const { user } = context;
    const body = await request.json();

    // 요청 데이터 검증
    const validationResult = createInvitationSchema.safeParse(body);
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

    const { storeId, email, roleHint, expiresInDays } = validationResult.data;
    const supabase = await createClient();

    // 매장 접근 권한 확인 (RLS가 처리하지만, 명시적 확인)
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

    // 권한 확인: 매장 소유자 또는 서브 매니저만 초대 생성 가능
    const isOwner = store.owner_id === user.id;
    const { data: userRole } = await supabase
      .from("user_store_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("store_id", storeId)
      .eq("status", "ACTIVE")
      .single();

    const isSubManager = userRole?.role === "SUB_MANAGER";

    if (!isOwner && !isSubManager) {
      return NextResponse.json(
        {
          success: false,
          error: "초대 생성 권한이 없습니다",
        },
        { status: 403 }
      );
    }

    // 기존 사용자 확인
    const { data: existingUser } = await supabase.auth.admin.listUsers();
    const isExistingUser = existingUser?.users?.some(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (isExistingUser) {
      return NextResponse.json(
        {
          success: false,
          error: "이미 등록된 사용자입니다. 직접 매장에 추가해주세요.",
        },
        { status: 400 }
      );
    }

    // 초대 생성 함수 호출
    const { data: invitationId, error: createError } = await supabase.rpc(
      "create_invitation",
      {
        p_store_id: storeId,
        p_invited_email: email,
        p_role_hint: roleHint,
        p_expires_in_days: expiresInDays,
        p_invited_by: user.id,
      }
    );

    if (createError) {
      console.error("초대 생성 오류:", createError);
      return NextResponse.json(
        {
          success: false,
          error: "초대 생성에 실패했습니다",
        },
        { status: 500 }
      );
    }

    // 초대 정보 조회 (이메일 전송용)
    const { data: invitation } = await supabase
      .from("invitations")
      .select("*")
      .eq("id", invitationId)
      .single();

    if (invitation) {
      try {
        // 초대 링크가 포함된 이메일 전송 (커스텀 이메일)
        const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/ko/invites/accept/${invitation.token_hash}`;

        console.log("초대 링크 생성:", {
          email,
          inviteUrl,
          storeName: store.name,
          roleHint,
        });

        // TODO: 실제 이메일 전송 구현
        // 현재는 로그로만 표시 (실제로는 SendGrid, Resend 등을 사용)
        console.log(`
=== 초대 이메일 ===
받는 사람: ${email}
매장명: ${store.name}
역할: ${roleHint}
초대 링크: ${inviteUrl}
초대자: ${user.user_metadata?.name || user.email || "관리자"}
====================
        `);

        // 개발 환경에서는 성공으로 처리
        // 실제 환경에서는 실제 이메일 서비스 연동 필요
      } catch (emailError) {
        console.error("이메일 전송 오류:", emailError);
      }
    }

    // 감사 로그 기록
    try {
      await supabase.rpc("log_store_audit", {
        p_store_id: storeId,
        p_action: "CREATE_INVITATION",
        p_table_name: "invitations",
        p_new_values: {
          invited_email: email,
          role_hint: roleHint,
          expires_in_days: expiresInDays,
          invited_by: user.id,
        },
      });
    } catch (auditError) {
      console.error("감사 로그 기록 실패:", auditError);
    }

    return NextResponse.json({
      success: true,
      data: { invitationId },
      message: "초대가 성공적으로 생성되었습니다",
    });
  } catch (error) {
    console.error("초대 생성 API 오류:", error);
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
 * 초대 목록 조회 API
 * GET /api/invitations?storeId=&status=&page=&limit=
 */
async function getInvitations(
  request: NextRequest,
  context: { user: any }
): Promise<NextResponse> {
  try {
    const { user } = context;
    const { searchParams } = new URL(request.url);

    // 쿼리 파라미터 파싱
    const storeId = searchParams.get("storeId");
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    const supabase = await createClient();

    // 매장 접근 권한 확인 (RLS가 처리하지만, 명시적 확인)
    if (storeId) {
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

      // 권한 확인: 매장 소유자 또는 서브 매니저만 초대 조회 가능
      const isOwner = store.owner_id === user.id;
      const { data: userRole } = await supabase
        .from("user_store_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("store_id", storeId)
        .eq("status", "ACTIVE")
        .single();

      const isSubManager = userRole?.role === "SUB_MANAGER";

      if (!isOwner && !isSubManager) {
        return NextResponse.json(
          {
            success: false,
            error: "초대 조회 권한이 없습니다",
          },
          { status: 403 }
        );
      }
    }

    // 초대 목록 조회 (invitations 테이블 직접 조회)
    let query = supabase.from("invitations").select("*");

    if (storeId) {
      query = query.eq("store_id", storeId);
    }
    if (status) {
      query = query.eq("status", status);
    }

    // 페이지네이션 적용
    query = query
      .range(offset, offset + limit - 1)
      .order("created_at", { ascending: false });

    const { data: invitations, error: invitationsError, count } = await query;

    if (invitationsError) {
      console.error("초대 목록 조회 오류:", invitationsError);
      return NextResponse.json(
        {
          success: false,
          error: "초대 목록 조회에 실패했습니다",
        },
        { status: 500 }
      );
    }

    // 매장 정보 추가
    const invitationsWithStoreInfo = await Promise.all(
      (invitations || []).map(async (invitation) => {
        const { data: store } = await supabase
          .from("stores")
          .select("name")
          .eq("id", invitation.store_id)
          .single();

        return {
          ...invitation,
          store_name: store?.name || "Unknown Store",
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        invitations: invitationsWithStoreInfo,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      },
    });
  } catch (error) {
    console.error("초대 목록 조회 API 오류:", error);
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
export async function POST(request: NextRequest) {
  return withAuth(async (req, context) => {
    return createInvitation(req, context);
  })(request);
}

export async function GET(request: NextRequest) {
  return withAuth(async (req, context) => {
    return getInvitations(req, context);
  })(request);
}
