import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { defaultLocale, isValidLocale, t, type Locale } from "@/lib/i18n";

/**
 * 초대 수락 요청 스키마
 */
const acceptInviteSchema = z.object({
  token: z.string().min(1),
});

type AcceptInviteRequest = z.infer<typeof acceptInviteSchema>;

function resolveLocale(request: NextRequest, localeParam?: string): Locale {
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
    const localeParam = typeof body?.locale === "string" ? body.locale : undefined;
    const locale = resolveLocale(request, localeParam);
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
          error: t("invite.accept.invalidToken", locale),
        },
        { status: 404 }
      );
    }

    // 이메일 일치 확인
    if (invite.email !== user.email) {
      return NextResponse.json(
        {
          success: false,
          error: t("invite.accept.emailMismatch", locale),
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
          error: t("invite.accept.alreadyMember", locale),
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
          error: t("invite.accept.processingError", locale),
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

    const roleName =
      invite.role === "SUB_MANAGER"
        ? t("invite.subManager", locale)
        : t("invite.partTimer", locale);

    // 성공 응답
    return NextResponse.json({
      success: true,
      data: {
        store: invite.store,
        role: invite.role,
        membership_id: null, // Supabase insert는 기본적으로 데이터를 반환하지 않음
      },
      message: t("invite.accept.joinedRoleMessage", locale, {
        storeName: invite.store.name,
        roleName,
      }),
    });
  } catch (error) {
    console.error("초대 수락 API 오류:", error);

    if (error instanceof z.ZodError) {
      const locale = defaultLocale;
      return NextResponse.json(
        {
          success: false,
          error: t("auth.login.validation.invalidData", locale),
          details: error.errors,
        },
        { status: 400 }
      );
    }

    const locale = defaultLocale;
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
 * 초대 정보 조회 API (토큰으로)
 * GET /api/invites/accept?token={token}
 */
async function getInviteInfo(request: NextRequest): Promise<NextResponse> {
  try {
    const localeParam = request.nextUrl.searchParams.get("locale") || undefined;
    const locale = resolveLocale(request, localeParam);
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: t("invite.accept.tokenRequired", locale),
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
          error: t("invite.accept.notFound", locale),
        },
        { status: 404 }
      );
    }

    // 초대 상태 확인
    const now = new Date();
    const expiresAt = new Date(invite.expires_at);
    const isExpired = now > expiresAt;

    let status = "valid";
    let statusMessage = t("invite.accept.status.valid", locale);

    if (invite.is_cancelled) {
      status = "cancelled";
      statusMessage = t("invite.accept.status.cancelled", locale);
    } else if (invite.is_used) {
      status = "used";
      statusMessage = t("invite.accept.status.used", locale);
    } else if (isExpired) {
      status = "expired";
      statusMessage = t("invite.accept.status.expired", locale);
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
    const locale = defaultLocale;
    return NextResponse.json(
      {
        success: false,
        error: t("auth.signup.error.serverError", locale),
      },
      { status: 500 }
    );
  }
}

// 인증된 사용자만 초대 수락 가능
export const POST = withAuth(acceptInvite);
// 초대 정보 조회는 인증 없이도 가능 (토큰으로 접근 제어)
export const GET = getInviteInfo;
