import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * 초대 생성 API
 * POST /api/invitations
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "인증이 필요합니다.",
        },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { email, storeId, roleHint, expiresInDays = 7 } = body;

    if (!email || !storeId || !roleHint) {
      return NextResponse.json(
        {
          success: false,
          error: "필수 필드가 누락되었습니다.",
        },
        { status: 400 }
      );
    }

    // 매장 확인
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

    // 기존 사용자인지 먼저 확인
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );
    console.log("찾는 이메일:", email);
    console.log(
      "기존 사용자 찾음:",
      existingUser ? existingUser.email : "없음"
    );

    // 이미 초대된 이메일인지 확인
    const { data: existingInvitation } = await supabase
      .from("invitations")
      .select("*")
      .eq("invited_email", email)
      .eq("store_id", storeId)
      .eq("status", "PENDING")
      .single();

    // 기존 사용자가 감지된 경우 - 기존 사용자용 로직 실행
    if (existingUser) {
      console.log("기존 사용자 감지됨 - 기존 사용자용 로직 실행");

      if (existingInvitation) {
        console.log("기존 초대 발견:", existingInvitation.id);
        console.log("기존 사용자에게 재발송:", email);

        // 기존 사용자는 메일 발송 없이 바로 매장에 초대
        console.log("기존 사용자 초대 성공 (메일 발송 없음):", {
          email,
          storeName: store.name,
          roleHint,
        });

        return NextResponse.json({
          success: true,
          data: {
            invitation: {
              id: existingInvitation.id,
              invited_email: email,
              role_hint: roleHint,
              expires_at: existingInvitation.expires_at,
              status: "PENDING",
            },
            message: "기존 사용자에게 매장 초대가 완료되었습니다.",
          },
        });
      } else {
        // 기존 사용자이지만 기존 초대가 없는 경우 - 새 초대 생성 (메일 발송 없음)
        console.log(
          "기존 사용자이지만 기존 초대 없음 - 새 초대 생성 (메일 발송 없음)"
        );

        // 먼저 초대 생성
        const { data: newInvitation, error: invitationError } = await supabase
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

        const newInvitationId = (newInvitation as any).id;

        console.log("기존 사용자 초대 성공 (메일 발송 없음):", {
          email,
          storeName: store.name,
          roleHint,
        });

        return NextResponse.json({
          success: true,
          data: {
            invitation: {
              id: newInvitationId,
              invited_email: email,
              role_hint: roleHint,
              expires_at: (newInvitation as any).expires_at,
              status: "PENDING",
            },
            message: "기존 사용자에게 매장 초대가 완료되었습니다.",
          },
        });
      }
    }

    // 기존 초대가 있지만 기존 사용자가 아닌 경우
    if (existingInvitation && !existingUser) {
      console.log(
        "기존 초대 발견하지만 기존 사용자 아님 - 기존 초대 삭제 후 새로 생성"
      );
      await supabase
        .from("invitations")
        .delete()
        .eq("id", existingInvitation.id);
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
        // inviteUserByEmail로 사용자 생성 및 이메일 발송
        console.log("사용자에게 이메일 발송 시도:", {
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

        console.log("초대 이메일 전송 성공:", {
          email,
          storeName: store.name,
          roleHint,
        });
      } catch (emailError) {
        console.error("이메일 전송 오류:", emailError);

        // 예외 발생 시 초대 레코드 삭제
        await supabase.from("invitations").delete().eq("id", invitationId);

        return NextResponse.json(
          {
            success: false,
            error:
              "이메일 발송 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
          },
          { status: 500 }
        );
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
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "인증이 필요합니다.",
        },
        { status: 401 }
      );
    }

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
      .from("invitations")
      .select("*")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    const offset = (page - 1) * limit;
    const { data: invitations, error: invitationsError } = await query.range(
      offset,
      offset + limit - 1
    );

    if (invitationsError) {
      console.error("초대 목록 조회 실패:", invitationsError);
      return NextResponse.json(
        {
          success: false,
          error: "초대 목록 조회에 실패했습니다.",
        },
        { status: 500 }
      );
    }

    // 전체 개수 조회
    let countQuery = supabase
      .from("invitations")
      .select("*", { count: "exact", head: true })
      .eq("store_id", storeId);

    if (status) {
      countQuery = countQuery.eq("status", status);
    }

    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error("초대 개수 조회 실패:", countError);
    }

    return NextResponse.json({
      success: true,
      data: {
        invitations: invitations || [],
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
