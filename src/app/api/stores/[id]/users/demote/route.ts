import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { defaultLocale, t, type Locale } from "@/lib/i18n";
import { resolveRequestLocale } from "@/lib/locale-request";

// 요청 데이터 검증 스키마
const demoteUserSchema = z.object({
  userId: z.string().uuid(),
});

/**
 * 서브 매니저를 파트타이머로 전환하는 API
 * POST /api/stores/[id]/users/demote
 */
async function demoteSubManager(
  request: NextRequest,
  context: { user: any; params: { id: string } }
): Promise<NextResponse> {
  try {
    const { user, params } = context;
    const locale = resolveRequestLocale(request);
    const storeId = params.id;
    const body = await request.json();

    // 요청 데이터 검증
    const validationResult = demoteUserSchema.safeParse(body);
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

    const { userId } = validationResult.data;
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

    // 권한 확인: 매장 소유자만 역할 변경 가능
    if (store.owner_id !== user.id) {
      return NextResponse.json(
        {
          success: false,
          error: t("role.changePermissionDenied", locale),
        },
        { status: 403 }
      );
    }

    // 대상 사용자의 현재 역할 확인
    const { data: currentRole, error: roleError } = await supabase
      .from("user_store_roles")
      .select("role, status")
      .eq("user_id", userId)
      .eq("store_id", storeId)
      .single();

    if (roleError || !currentRole) {
      return NextResponse.json(
        {
          success: false,
          error: t("user.roleNotFound", locale),
        },
        { status: 404 }
      );
    }

    if (currentRole.role !== "SUB_MANAGER") {
      return NextResponse.json(
        {
          success: false,
          error: t("user.onlySubManagerCanDemote", locale),
        },
        { status: 400 }
      );
    }

    if (currentRole.status !== "ACTIVE") {
      return NextResponse.json(
        {
          success: false,
          error: t("user.onlyActiveSubManagerCanDemote", locale),
        },
        { status: 400 }
      );
    }

    // 서브 매니저를 파트타이머로 전환
    const { data: result, error: demoteError } = await supabase.rpc(
      "demote_sub_manager_to_part_timer",
      {
        p_user_id: userId,
        p_store_id: storeId,
        p_demoted_by: user.id,
      }
    );

    if (demoteError) {
      console.error("서브 매니저 전환 오류:", demoteError);
      return NextResponse.json(
        {
          success: false,
          error: t("user.demoteSubManagerError", locale),
        },
        { status: 500 }
      );
    }

    // 감사 로그 기록
    try {
      await supabase.rpc("log_store_audit", {
        p_store_id: storeId,
        p_action: "DEMOTE_SUB_MANAGER",
        p_table_name: "user_store_roles",
        p_old_values: {
          user_id: userId,
          role: "SUB_MANAGER",
          status: "ACTIVE",
        },
        p_new_values: {
          user_id: userId,
          role: "PART_TIMER",
          status: "ACTIVE",
          demoted_by: user.id,
        },
      });
    } catch (auditError) {
      console.error("감사 로그 기록 실패:", auditError);
    }

    return NextResponse.json({
      success: true,
      data: { demoted: result },
      message: t("user.demoteSubManagerDescription", locale),
    });
  } catch (error) {
    console.error("서브 매니저 전환 API 오류:", error);
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
    return demoteSubManager(req, { ...context, params: resolvedParams });
  })(request);
}
