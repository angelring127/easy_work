import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { defaultLocale, t, type Locale } from "@/lib/i18n";
import { resolveRequestLocale } from "@/lib/locale-request";

// 요청 데이터 검증 스키마
const deactivateUserSchema = z.object({
  userId: z.string().uuid(),
});

/**
 * 사용자 비활성화 API
 * POST /api/stores/[id]/users/deactivate
 */
async function deactivateUser(
  request: NextRequest,
  context: { user: any; params: { id: string } }
): Promise<NextResponse> {
  try {
    const { user, params } = context;
    const locale = resolveRequestLocale(request);
    const storeId = params.id;
    const body = await request.json();

    // 요청 데이터 검증
    const validationResult = deactivateUserSchema.safeParse(body);
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

    // 권한 확인: 매장 소유자만 사용자 비활성화 가능
    if (store.owner_id !== user.id) {
      return NextResponse.json(
        {
          success: false,
          error: t("user.deactivatePermissionDenied", locale),
        },
        { status: 403 }
      );
    }

    // 대상 사용자의 현재 상태 확인
    const { data: currentUser, error: userError } = await supabase
      .from("user_store_roles")
      .select("role, status")
      .eq("user_id", userId)
      .eq("store_id", storeId)
      .single();

    if (userError || !currentUser) {
      return NextResponse.json(
        {
          success: false,
          error: t("user.notFound", locale),
        },
        { status: 404 }
      );
    }

    if (currentUser.status === "INACTIVE") {
      return NextResponse.json(
        {
          success: false,
          error: t("user.alreadyInactive", locale),
        },
        { status: 400 }
      );
    }

    // 사용자 비활성화
    const { data: result, error: deactivateError } = await supabase.rpc(
      "deactivate_user",
      {
        p_user_id: userId,
        p_store_id: storeId,
        p_deactivated_by: user.id,
      }
    );

    if (deactivateError) {
      console.error("사용자 비활성화 오류:", deactivateError);
      return NextResponse.json(
        {
          success: false,
          error: t("user.deactivateUserError", locale),
        },
        { status: 500 }
      );
    }

    // 감사 로그 기록
    try {
      await supabase.rpc("log_store_audit", {
        p_store_id: storeId,
        p_action: "DEACTIVATE_USER",
        p_table_name: "user_store_roles",
        p_old_values: {
          user_id: userId,
          role: currentUser.role,
          status: "ACTIVE",
        },
        p_new_values: {
          user_id: userId,
          role: currentUser.role,
          status: "INACTIVE",
          deactivated_by: user.id,
        },
      });
    } catch (auditError) {
      console.error("감사 로그 기록 실패:", auditError);
    }

    return NextResponse.json({
      success: true,
      data: { deactivated: result },
      message: t("user.deactivateUserDescription", locale),
    });
  } catch (error) {
    console.error("사용자 비활성화 API 오류:", error);
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
    return deactivateUser(req, { ...context, params: resolvedParams });
  })(request);
}
