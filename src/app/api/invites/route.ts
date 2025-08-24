import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/auth/middleware";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import type { Database, Tables } from "@/lib/supabase/types";

/**
 * 초대 생성 요청 스키마
 */
const createInviteSchema = z.object({
  email: z.string().email("유효한 이메일 주소를 입력해주세요"),
  role: z.enum(["SUB_MANAGER", "PART_TIMER"], {
    errorMap: () => ({ message: "유효한 역할을 선택해주세요" }),
  }),
  store_id: z.string().uuid("유효한 매장 ID를 입력해주세요"),
});

type CreateInviteRequest = z.infer<typeof createInviteSchema>;

/**
 * 초대 생성 API
 * POST /api/invites
 */
async function createInvite(
  request: NextRequest,
  context: { user: any }
): Promise<NextResponse> {
  try {
    const { user } = context;
    const supabase = await createClient();

    // 요청 데이터 검증
    const body = await request.json();
    const validatedData = createInviteSchema.parse(body);
    const { email, role, store_id } = validatedData;

    // 매장 권한 확인 (MASTER이거나 해당 매장의 SUB_MANAGER)
    const { data: storeAccess, error: storeError } = await supabase
      .from("stores")
      .select("*")
      .eq("id", store_id)
      .single();

    if (storeError || !storeAccess) {
      return NextResponse.json(
        {
          success: false,
          error: "매장을 찾을 수 없거나 접근 권한이 없습니다",
        },
        { status: 404 }
      );
    }

    // SUB_MANAGER인 경우 해당 매장의 관리 권한이 있는지 확인
    if (user.role === "SUB_MANAGER") {
      const { data: managerRole, error: roleError } = await supabase
        .from("store_users")
        .select("*")
        .eq("store_id", store_id)
        .eq("user_id", user.id)
        .eq("role", "SUB_MANAGER")
        .eq("is_active", true)
        .single();

      if (roleError || !managerRole) {
        return NextResponse.json(
          {
            success: false,
            error: "해당 매장의 관리 권한이 없습니다",
          },
          { status: 403 }
        );
      }
    }

    // 이미 같은 이메일로 활성화된 초대가 있는지 확인
    const { data: existingInvite } = await supabase
      .from("invites")
      .select("*")
      .eq("store_id", store_id)
      .eq("email", email)
      .eq("is_used", false)
      .eq("is_cancelled", false)
      .gte("expires_at", new Date().toISOString())
      .single();

    if (existingInvite) {
      return NextResponse.json(
        {
          success: false,
          error: "이미 해당 이메일로 유효한 초대가 존재합니다",
        },
        { status: 409 }
      );
    }

    // 이미 해당 매장에 속한 사용자인지 확인 (이메일로 사용자 조회)
    // Supabase Admin API의 getUserByEmail이 없으므로 다른 방법 사용
    // 실제로는 초대를 보낸 후 사용자가 가입할 때 중복 체크를 하는 것이 더 적절함

    // 현재는 초대 생성만 허용하고, 실제 가입 시점에 중복 체크

    // 초대 토큰 생성
    const { data: tokenResult, error: tokenError } = await supabase.rpc(
      "generate_invite_token"
    );

    if (tokenError || !tokenResult) {
      return NextResponse.json(
        {
          success: false,
          error: "초대 토큰 생성에 실패했습니다",
        },
        { status: 500 }
      );
    }

    // 만료 시간 설정 (7일 후)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // 초대 생성
    const { data: invite, error: inviteError } = await supabase
      .from("invites")
      .insert({
        store_id,
        email,
        role,
        token: tokenResult,
        invited_by: user.id,
        expires_at: expiresAt.toISOString(),
      })
      .select("*")
      .single();

    if (inviteError || !invite) {
      console.error("초대 생성 오류:", inviteError);
      return NextResponse.json(
        {
          success: false,
          error: "초대 생성에 실패했습니다",
        },
        { status: 500 }
      );
    }

    // 매장 정보와 함께 응답
    const response = {
      success: true,
      data: {
        ...invite,
        store: storeAccess,
        invite_url: `${request.nextUrl.origin}/ko/invites/accept/${tokenResult}`,
      },
      message: "초대가 성공적으로 생성되었습니다",
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("초대 생성 API 오류:", error);

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
 * 초대 목록 조회 API
 * GET /api/invites?store_id={store_id}
 */
async function getInvites(
  request: NextRequest,
  context: { user: any }
): Promise<NextResponse> {
  try {
    const { user } = context;
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get("store_id");

    if (!storeId) {
      return NextResponse.json(
        {
          success: false,
          error: "매장 ID가 필요합니다",
        },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // 매장 접근 권한 확인
    const { data: storeAccess, error: storeError } = await supabase
      .from("stores")
      .select("*")
      .eq("id", storeId)
      .single();

    if (storeError || !storeAccess) {
      return NextResponse.json(
        {
          success: false,
          error: "매장을 찾을 수 없거나 접근 권한이 없습니다",
        },
        { status: 404 }
      );
    }

    // 초대 목록 조회
    const { data: invites, error: invitesError } = await supabase
      .from("invites")
      .select(
        `
        *,
        invited_by_user:invited_by(email),
        accepted_by_user:accepted_by(email)
      `
      )
      .eq("store_id", storeId)
      .order("invited_at", { ascending: false });

    if (invitesError) {
      console.error("초대 목록 조회 오류:", invitesError);
      return NextResponse.json(
        {
          success: false,
          error: "초대 목록 조회에 실패했습니다",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: invites || [],
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

// 관리자 권한 확인 미들웨어로 래핑
export const POST = withAdminAuth(createInvite);
export const GET = withAdminAuth(getInvites);
