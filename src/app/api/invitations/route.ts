import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

// 초대 생성 스키마
const createInvitationSchema = z.object({
  email: z.string().email("유효한 이메일을 입력해주세요"),
  roleHint: z.enum(["PART_TIMER", "SUB_MANAGER"], {
    errorMap: () => ({ message: "유효한 역할을 선택해주세요" }),
  }),
  storeId: z.string().uuid("유효한 매장 ID를 입력해주세요"),
  expiresInDays: z.number().min(1).max(30).default(7),
});

/**
 * 초대 생성 API
 * POST /api/invitations
 */
async function createInvitation(request: NextRequest, context: { user: any }) {
  try {
    const { user } = context;
    const body = await request.json();

    console.log("초대 생성 요청:", {
      user: user.email,
      body,
    });

    // 입력 검증
    const validationResult = createInvitationSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: validationResult.error.errors[0].message,
        },
        { status: 400 }
      );
    }

    const { email, roleHint, storeId, expiresInDays } = validationResult.data;

    const supabase = await createClient();

    // 매장 정보 조회
    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("*")
      .eq("id", storeId)
      .single();

    if (storeError || !store) {
      return NextResponse.json(
        {
          success: false,
          error: "매장을 찾을 수 없습니다.",
        },
        { status: 404 }
      );
    }

    // 권한 확인 (마스터 또는 서브 매니저만 초대 가능)
    const { data: userRole } = await supabase
      .from("user_store_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("store_id", storeId)
      .single();

    if (!userRole || !["MASTER", "SUB_MANAGER"].includes(userRole.role)) {
      return NextResponse.json(
        {
          success: false,
          error: "초대를 생성할 권한이 없습니다.",
        },
        { status: 403 }
      );
    }

    // 이미 초대된 이메일인지 확인
    const { data: existingInvitation } = await supabase
      .from("invitations")
      .select("*")
      .eq("invited_email", email)
      .eq("store_id", storeId)
      .eq("status", "PENDING")
      .single();

    if (existingInvitation) {
      return NextResponse.json(
        {
          success: false,
          error: "이미 초대된 이메일입니다.",
        },
        { status: 400 }
      );
    }

    // 초대 생성
    const { data: invitation, error: invitationError } = await supabase
      .rpc("create_invitation", {
        p_store_id: storeId,
        p_invited_email: email,
        p_role_hint: roleHint,
        p_expires_in_days: expiresInDays,
        p_invited_by: user.id,
      })
      .single();

    if (invitationError) {
      console.error("초대 생성 실패:", invitationError);
      return NextResponse.json(
        {
          success: false,
          error: "초대 생성에 실패했습니다.",
        },
        { status: 500 }
      );
    }

    const invitationId = (invitation as any).id;

    if (invitation) {
      try {
        // 새 사용자 생성 시도 (기존 사용자면 오류 발생)
        let signUpData = null;
        let signUpError = null;

        try {
          const result = await supabase.auth.admin.createUser({
            email: email,
            password: "1q2w3e4r!", // 기본 패스워드
            email_confirm: true, // 이메일 자동 확인
            user_metadata: {
              store_id: storeId,
              store_name: store.name,
              role_hint: roleHint,
              token_hash: (invitation as any).token_hash,
              type: "store_invitation",
              invited_by: user.user_metadata?.name || user.email || "관리자",
              is_invited_user: true,
              needs_password_change: true, // 패스워드 변경 필요 플래그
            },
          });
          signUpData = result.data;
          signUpError = result.error;
        } catch (error) {
          signUpError = error;
        }

        // 기존 사용자인 경우
        if (
          signUpError &&
          signUpError.message?.includes("already been registered")
        ) {
          console.log("기존 사용자 발견:", email);

          // 기존 사용자에게 이메일 발송 (inviteUserByEmail 사용)
          console.log("기존 사용자에게 이메일 발송 시도:", {
            email,
            redirectTo: `${
              process.env.NEXT_PUBLIC_APP_URL
            }/ko/invites/verify-email?token=${
              (invitation as any).token_hash
            }&type=invite`,
          });

          const { error: emailError } =
            await supabase.auth.admin.inviteUserByEmail(email, {
              data: {
                store_id: storeId,
                store_name: store.name,
                role_hint: roleHint,
                token_hash: (invitation as any).token_hash,
                type: "store_invitation",
                invited_by: user.user_metadata?.name || user.email || "관리자",
                is_invited_user: true,
              },
              redirectTo: `${
                process.env.NEXT_PUBLIC_APP_URL
              }/ko/invites/verify-email?token=${
                (invitation as any).token_hash
              }&type=invite`,
            });

          if (emailError) {
            console.error("이메일 발송 실패:", emailError);
            await supabase.from("invitations").delete().eq("id", invitationId);
            return NextResponse.json(
              {
                success: false,
                error: "이메일 발송에 실패했습니다.",
              },
              { status: 500 }
            );
          }

          console.log("기존 사용자 초대 이메일 발송 성공:", {
            email,
            storeName: store.name,
            roleHint,
          });

          return NextResponse.json({
            success: true,
            data: {
              invitation: {
                id: invitationId,
                invited_email: email,
                role_hint: roleHint,
                expires_at: (invitation as any).expires_at,
                status: "PENDING",
              },
              message: "기존 사용자에게 초대 이메일이 발송되었습니다.",
            },
          });
        }

        // 새 사용자 생성 실패 (다른 오류)
        if (signUpError) {
          console.error("사용자 생성 실패:", signUpError);

          // 사용자 생성 실패 시 초대 레코드 삭제
          await supabase.from("invitations").delete().eq("id", invitationId);

          return NextResponse.json(
            {
              success: false,
              error: "사용자 생성에 실패했습니다. 이메일 주소를 확인해주세요.",
            },
            { status: 500 }
          );
        }

        // 새 사용자 생성 성공 시 이메일 발송
        console.log("새 사용자 생성 성공:", signUpData.user.email);

        // 새 사용자에게 이메일 발송 (inviteUserByEmail 사용)
        console.log("새 사용자에게 이메일 발송 시도:", {
          email,
          redirectTo: `${
            process.env.NEXT_PUBLIC_APP_URL
          }/ko/invites/verify-email?token=${
            (invitation as any).token_hash
          }&type=invite`,
        });

        const { error: emailError } =
          await supabase.auth.admin.inviteUserByEmail(email, {
            data: {
              store_id: storeId,
              store_name: store.name,
              role_hint: roleHint,
              token_hash: (invitation as any).token_hash,
              type: "store_invitation",
              invited_by: user.user_metadata?.name || user.email || "관리자",
              is_invited_user: true,
            },
            redirectTo: `${
              process.env.NEXT_PUBLIC_APP_URL
            }/ko/invites/verify-email?token=${
              (invitation as any).token_hash
            }&type=invite`,
          });

        if (emailError) {
          console.error("이메일 발송 실패:", emailError);

          // 이메일 발송 실패 시 사용자와 초대 레코드 삭제
          await supabase.auth.admin.deleteUser(signUpData.user.id);
          await supabase.from("invitations").delete().eq("id", invitationId);

          return NextResponse.json(
            {
              success: false,
              error: "이메일 발송에 실패했습니다.",
            },
            { status: 500 }
          );
        }

        console.log("새 사용자 초대 이메일 전송 성공:", {
          email,
          storeName: store.name,
          roleHint,
        });
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
async function getInvitations(request: NextRequest, context: { user: any }) {
  try {
    const { user } = context;
    const { searchParams } = new URL(request.url);

    const storeId = searchParams.get("storeId");
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");

    if (!storeId) {
      return NextResponse.json(
        {
          success: false,
          error: "매장 ID가 필요합니다.",
        },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // 권한 확인
    const { data: userRole } = await supabase
      .from("user_store_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("store_id", storeId)
      .single();

    if (!userRole || !["MASTER", "SUB_MANAGER"].includes(userRole.role)) {
      return NextResponse.json(
        {
          success: false,
          error: "초대 목록을 조회할 권한이 없습니다.",
        },
        { status: 403 }
      );
    }

    // 초대 목록 조회
    let query = supabase
      .from("invitation_details")
      .select("*")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    const { data: invitations, error } = await query.range(
      (page - 1) * limit,
      page * limit - 1
    );

    if (error) {
      console.error("초대 목록 조회 실패:", error);
      return NextResponse.json(
        {
          success: false,
          error: "초대 목록 조회에 실패했습니다.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        invitations,
        pagination: {
          page,
          limit,
          hasMore: invitations.length === limit,
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

export { createInvitation, getInvitations };

// Next.js 라우트 핸들러
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json(
      { success: false, error: "인증이 필요합니다." },
      { status: 401 }
    );
  }

  return createInvitation(request, { user });
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json(
      { success: false, error: "인증이 필요합니다." },
      { status: 401 }
    );
  }

  return getInvitations(request, { user });
}
