import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { validateScheduleRoleRequirements } from "@/lib/schedule/role-coverage";
import { defaultLocale, isValidLocale, type Locale } from "@/lib/i18n";

// 입력 검증 스키마 (제출 전의 간단한 체크)
const AssignmentSchema = z.object({
  storeId: z.string().uuid(),
  date: z.string(), // ISO date
  startMin: z.number().int().min(0).max(1440),
  endMin: z.number().int().min(0).max(1440),
  roleHint: z.string().optional(),
  locale: z.string().optional(),
  workItemIds: z.array(z.string().uuid()).optional(), // 근무 항목 ID 배열
  assignedUsers: z.array(z.string().uuid()).optional(), // 배정된 유저 ID 배열
});

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

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();

  const parsed = AssignmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user)
    return NextResponse.json(
      { success: false, error: "unauthorized" },
      { status: 401 }
    );

  const {
    storeId,
    startMin,
    endMin,
    roleHint,
    locale: localeParam,
    workItemIds,
    assignedUsers,
  } = parsed.data;
  const locale = resolveLocale(request, localeParam);

  // 1) end > start
  if (endMin <= startMin) {
    return NextResponse.json(
      { success: false, code: "schedule.errors.endAfterStart" },
      { status: 400 }
    );
  }

  // 2) freeze policy: stores.freeze_hours_before_shift は事前計算が必要
  //    ここではストア設定を読み出し、現在時刻と比較（簡易チェック）。
  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("id, freeze_hours_before_shift")
    .eq("id", storeId)
    .single();
  if (storeError || !store)
    return NextResponse.json(
      { success: false, error: "store not found" },
      { status: 404 }
    );

  // NOTE: フリーズチェックはシンプル化（厳密には勤務開始日時のタイムゾーン変換が必要）
  // クライアント側で補助する前提でここでは省略

  // 3) work_items.max_headcount / staffing_targets.min/max 簡易検証
  //    実装簡略化: 同時間帯の既存割当の人数を集計するかわりに、テンプレート/ターゲットを取得して閾値存在だけ確認。
  const { data: templates } = await supabase
    .from("work_items")
    .select("max_headcount, role_hint, start_min, end_min")
    .eq("store_id", storeId);

  const { data: targets } = await supabase
    .from("staffing_targets")
    .select(
      "weekday, start_min, end_min, role_hint, min_headcount, max_headcount"
    )
    .eq("store_id", storeId);

  // ここでは閾値の存在チェックのみ（実数判定は保存APIで再検証）
  const hasAnyTemplate = (templates ?? []).some(
    (t) => endMin > t.start_min && startMin < t.end_min
  );
  const hasAnyTarget = (targets ?? []).some(
    (t) =>
      endMin > t.start_min &&
      startMin < t.end_min &&
      (!roleHint || !t.role_hint || t.role_hint === roleHint)
  );

  if (!hasAnyTemplate && !hasAnyTarget) {
    // 어떤 템플릿/타겟에도 매치하지 않음 → 사용자에게 확인
    return NextResponse.json(
      { success: false, code: "schedule.errors.underMinTarget" },
      { status: 400 }
    );
  }

  // 4) 역할 요구 사항 충족 검증 (새로 추가)
  let roleValidation = null;
  if (
    workItemIds &&
    workItemIds.length > 0 &&
    assignedUsers &&
    assignedUsers.length > 0
  ) {
    try {
      roleValidation = await validateScheduleRoleRequirements(
        storeId,
        workItemIds,
        assignedUsers,
        locale
      );

      if (!roleValidation.isValid) {
        return NextResponse.json(
          {
            success: false,
            code: "schedule.errors.insufficientRoleCoverage",
            details: {
              roleCoverage: roleValidation.roleCoverage,
              insufficientRoles: roleValidation.insufficientRoles,
              message: roleValidation.message,
            },
          },
          { status: 400 }
        );
      }
    } catch (error) {
      console.error("역할 검증 오류:", error);
      return NextResponse.json(
        {
          success: false,
          code: "schedule.errors.roleValidationError",
          error:
            locale === "ko"
              ? "역할 검증 중 오류가 발생했습니다."
              : locale === "ja"
                ? "役割検証中にエラーが発生しました。"
                : "An error occurred during role validation.",
        },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    success: true,
    roleValidation: roleValidation,
  });
}
