import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/auth/middleware";
import { createClient } from "@/lib/supabase/server";
import { defaultLocale, isValidLocale, t, type Locale } from "@/lib/i18n";

function resolveLocale(request: NextRequest): Locale {
  const localeParam = request.nextUrl.searchParams.get("locale");
  if (localeParam && isValidLocale(localeParam)) {
    return localeParam;
  }

  const acceptLanguage = request.headers.get("accept-language");
  const preferredLocale = acceptLanguage?.split(",")[0]?.split("-")[0];
  if (preferredLocale && isValidLocale(preferredLocale)) {
    return preferredLocale;
  }

  return defaultLocale;
}

/**
 * 특정 초대 정보 조회 API
 * GET /api/invites/[id]
 */
async function getInvite(
  request: NextRequest,
  context: { user: any; params: { id: string } }
): Promise<NextResponse> {
  try {
    const { user, params } = context;
    const locale = resolveLocale(request);
    const inviteId = params.id;

    const supabase = await createClient();

    // 초대 정보 조회
    const { data: invite, error: inviteError } = await supabase
      .from("invites")
      .select(
        `
        *,
        store:stores(*),
        invited_by_user:invited_by(email, id),
        accepted_by_user:accepted_by(email, id)
      `
      )
      .eq("id", inviteId)
      .single();

    if (inviteError || !invite) {
      return NextResponse.json(
        {
          success: false,
          error: t("invite.accept.notFound", locale),
        },
        { status: 404 }
      );
    }

    // 매장 접근 권한 확인
    const { data: storeAccess, error: storeError } = await supabase
      .from("stores")
      .select("*")
      .eq("id", invite.store_id)
      .single();

    if (storeError || !storeAccess) {
      return NextResponse.json(
        {
          success: false,
          error: t("invite.accessDenied", locale),
        },
        { status: 403 }
      );
    }

    // SUB_MANAGER인 경우 해당 매장의 관리 권한 확인
    if (user.role === "SUB_MANAGER") {
      const { data: managerRole, error: roleError } = await supabase
        .from("store_users")
        .select("*")
        .eq("store_id", invite.store_id)
        .eq("user_id", user.id)
        .eq("role", "SUB_MANAGER")
        .eq("is_active", true)
        .single();

      if (roleError || !managerRole) {
        return NextResponse.json(
          {
            success: false,
            error: t("invite.managePermissionDenied", locale),
          },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      data: invite,
    });
  } catch (error) {
    console.error("초대 정보 조회 API 오류:", error);
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

/**
 * 초대 취소 API
 * DELETE /api/invites/[id]
 */
async function cancelInvite(
  request: NextRequest,
  context: { user: any; params: { id: string } }
): Promise<NextResponse> {
  try {
    const { user, params } = context;
    const locale = resolveLocale(request);
    const inviteId = params.id;

    const supabase = await createClient();

    // 초대 정보 조회
    const { data: invite, error: inviteError } = await supabase
      .from("invites")
      .select("*")
      .eq("id", inviteId)
      .single();

    if (inviteError || !invite) {
      return NextResponse.json(
        {
          success: false,
          error: t("invite.accept.notFound", locale),
        },
        { status: 404 }
      );
    }

    // 이미 사용되었거나 취소된 초대인지 확인
    if (invite.is_used) {
      return NextResponse.json(
        {
          success: false,
          error: t("invite.cancelUsed", locale),
        },
        { status: 400 }
      );
    }

    if (invite.is_cancelled) {
      return NextResponse.json(
        {
          success: false,
          error: t("invite.alreadyCancelled", locale),
        },
        { status: 400 }
      );
    }

    // 매장 접근 권한 확인
    const { data: storeAccess, error: storeError } = await supabase
      .from("stores")
      .select("*")
      .eq("id", invite.store_id)
      .single();

    if (storeError || !storeAccess) {
      return NextResponse.json(
        {
          success: false,
          error: t("invite.accessDenied", locale),
        },
        { status: 403 }
      );
    }

    // SUB_MANAGER인 경우 해당 매장의 관리 권한 확인
    if (user.role === "SUB_MANAGER") {
      const { data: managerRole, error: roleError } = await supabase
        .from("store_users")
        .select("*")
        .eq("store_id", invite.store_id)
        .eq("user_id", user.id)
        .eq("role", "SUB_MANAGER")
        .eq("is_active", true)
        .single();

      if (roleError || !managerRole) {
        return NextResponse.json(
          {
            success: false,
            error: t("invite.managePermissionDenied", locale),
          },
          { status: 403 }
        );
      }
    }

    // 초대 취소
    const { data: cancelledInvite, error: cancelError } = await supabase
      .from("invites")
      .update({
        is_cancelled: true,
      })
      .eq("id", inviteId)
      .select("*")
      .single();

    if (cancelError) {
      console.error("초대 취소 오류:", cancelError);
      return NextResponse.json(
        {
          success: false,
          error: t("invite.cancelError", locale),
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: cancelledInvite,
      message: t("invite.cancelSuccess", locale),
    });
  } catch (error) {
    console.error("초대 취소 API 오류:", error);
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
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  return withAdminAuth((req, context) =>
    getInvite(req, { ...context, params: resolvedParams })
  )(request);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  return withAdminAuth((req, context) =>
    cancelInvite(req, { ...context, params: resolvedParams })
  )(request);
}
