import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { createClient, createPureClient } from "@/lib/supabase/server";
import { z } from "zod";
import { defaultLocale, t, type Locale } from "@/lib/i18n";
import { resolveRequestLocale } from "@/lib/locale-request";

// 요청 데이터 검증 스키마
const grantRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["SUB_MANAGER", "PART_TIMER"]),
});

/**
 * 사용자 역할 부여 API
 * POST /api/stores/[id]/roles/grant
 */
async function grantUserRole(
  request: NextRequest,
  context: { user: any; params: { id: string } }
): Promise<NextResponse> {
  try {
    const { user, params } = context;
    const locale = resolveRequestLocale(request);
    const storeId = params.id;
    const body = await request.json();

    // 요청 데이터 검증
    const validationResult = grantRoleSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: t("auth.login.validation.invalidData", locale),
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { userId, role } = validationResult.data;
    const supabase = await createClient();

    // 매장 접근 권한 확인
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
          error: t("store.notFound", locale),
        },
        { status: 404 }
      );
    }

    // 권한 확인: 매장 소유자만 역할 부여 가능
    if (store.owner_id !== user.id) {
      return NextResponse.json(
        {
          success: false,
          error: t("role.grantPermissionDenied", locale),
        },
        { status: 403 }
      );
    }

    // 대상 사용자 존재 확인 - Admin API 사용을 위해 Service Role Key 클라이언트 사용
    const adminClient = await createPureClient();
    const { data: targetUser, error: userError } =
      await adminClient.auth.admin.getUserById(userId);
    if (userError || !targetUser.user) {
      return NextResponse.json(
        {
          success: false,
          error: t("user.notFound", locale),
        },
        { status: 404 }
      );
    }

    // 역할 부여 함수 호출
    const { data: result, error: grantError } = await supabase.rpc(
      "grant_user_role",
      {
        p_user_id: userId,
        p_store_id: storeId,
        p_role: role,
        p_granted_by: user.id,
      }
    );

    if (grantError) {
      console.error("역할 부여 오류:", grantError);
      return NextResponse.json(
        {
          success: false,
          error: t("user.roleGrantError", locale),
        },
        { status: 500 }
      );
    }

    // 감사 로그 기록
    try {
      await supabase.rpc("log_store_audit", {
        p_store_id: storeId,
        p_action: "GRANT_ROLE",
        p_table_name: "user_store_roles",
        p_new_values: {
          user_id: userId,
          role: role,
          granted_by: user.id,
        },
      });
    } catch (auditError) {
      console.error("감사 로그 기록 실패:", auditError);
    }

    return NextResponse.json({
      success: true,
      data: { roleId: result },
      message: t("user.roleGrantedDescription", locale),
    });
  } catch (error) {
    console.error("역할 부여 API 오류:", error);
    const locale: Locale = defaultLocale;
    return NextResponse.json(
      {
        success: false,
        error: t("auth.signup.error.serverError", locale),
      },
      { status: 500 }
    );
  }
}

// Next.js 동적 라우트 핸들러
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  return withAuth(async (req, context) => {
    return grantUserRole(req, { ...context, params: resolvedParams });
  })(request);
}
