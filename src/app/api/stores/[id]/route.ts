import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/auth/middleware";
import { createClient } from "@/lib/supabase/server";

// 매장 수정 스키마
const updateStoreSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  timezone: z.string().optional(),
  status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
  week_start: z.number().int().min(0).max(6).optional(),
  brand_color: z.string().optional(),
  publish_cutoff_hours: z.number().int().min(0).max(168).optional(),
  freeze_hours_before_shift: z.number().int().min(0).max(168).optional(),
  swap_lead_time_hours: z.number().int().min(0).max(168).optional(),
  swap_require_same_role: z.boolean().optional(),
  swap_auto_approve_threshold: z.number().int().min(0).max(168).optional(),
  min_rest_hours_between_shifts: z.number().int().min(0).max(48).optional(),
  max_hours_per_day: z.number().int().min(0).max(24).optional(),
  max_hours_per_week: z.number().int().min(0).max(168).optional(),
  max_hours_per_month: z.number().min(1).max(999.99).optional(),
  max_consecutive_days: z.number().int().min(0).max(14).optional(),
  weekly_labor_budget_cents: z.number().int().min(0).optional(),
  night_shift_boundary_min: z.number().int().min(0).max(1440).optional(),
  shift_boundary_time_min: z.number().int().min(0).max(1440).optional(),
});

type UpdateStoreRequest = z.infer<typeof updateStoreSchema>;

/**
 * 매장 정보 조회 API
 * GET /api/stores/[id]
 */
async function getStore(
  request: NextRequest,
  context: { user: any; params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { user } = context;
    const params = await context.params;
    const storeId = params.id;

    const supabase = await createClient();

    // 매장 정보 조회 (직접 쿼리 사용)
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

    // 접근 권한 확인: 소유자만 접근 가능
    if (store.owner_id !== user.id) {
      return NextResponse.json(
        {
          success: false,
          error: "매장에 접근할 권한이 없습니다",
        },
        { status: 403 }
      );
    }

    // 사용자 역할 정보 추가
    const storeWithRole = {
      ...store,
      user_role: "MASTER",
      granted_at: store.created_at,
    };

    return NextResponse.json({
      success: true,
      data: storeWithRole,
    });
  } catch (error) {
    console.error("매장 조회 API 오류:", error);
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
 * 매장 정보 수정 API
 * PATCH /api/stores/[id]
 * 마스터는 모든 필드 수정 가능, 서브는 제한적 수정만 가능
 */
async function updateStore(
  request: NextRequest,
  context: { user: any; params: { id: string } }
): Promise<NextResponse> {
  try {
    const { user, params } = context;
    const storeId = params.id;

    const supabase = await createClient();

    // 요청 데이터 검증
    const body = await request.json();
    const validatedData = updateStoreSchema.parse(body);

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
          error: "매장을 찾을 수 없습니다",
        },
        { status: 404 }
      );
    }

    // 권한 확인: 소유자만 수정 가능
    if (store.owner_id !== user.id) {
      return NextResponse.json(
        {
          success: false,
          error: "매장 수정 권한이 없습니다",
        },
        { status: 403 }
      );
    }

    // 기존 데이터 백업 (감사 로그용)
    const oldValues = { ...store };

    // 매장 정보 수정 (확장 필드 포함)
    const { data: updatedStore, error: updateError } = await supabase
      .from("stores")
      .update(validatedData)
      .eq("id", storeId)
      .select("*")
      .single();

    if (updateError) {
      console.error("매장 수정 오류:", updateError);
      return NextResponse.json(
        {
          success: false,
          error: "매장 수정에 실패했습니다",
        },
        { status: 500 }
      );
    }

    // 감사 로그 기록 (선택적)
    try {
      await supabase.rpc("log_store_audit", {
        p_store_id: storeId,
        p_action: "UPDATE",
        p_table_name: "stores",
        p_old_values: oldValues,
        p_new_values: updatedStore,
      });
    } catch (auditError) {
      console.warn("감사 로그 기록 실패:", auditError);
    }

    return NextResponse.json({
      success: true,
      data: updatedStore,
      message: "매장 정보가 성공적으로 수정되었습니다",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "입력 데이터가 올바르지 않습니다",
          details: error.errors,
        },
        { status: 400 }
      );
    }

    console.error("매장 수정 API 오류:", error);
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
 * 매장 소프트 삭제 API
 * DELETE /api/stores/[id]
 * 마스터만 매장을 보관(ARCHIVED)할 수 있습니다.
 */
async function deleteStore(
  request: NextRequest,
  context: { user: any; params: { id: string } }
): Promise<NextResponse> {
  try {
    const { user, params } = context;
    const storeId = params.id;

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
          error: "매장을 찾을 수 없습니다",
        },
        { status: 404 }
      );
    }

    // 소유자만 삭제 가능
    if (store.owner_id !== user.id) {
      return NextResponse.json(
        {
          success: false,
          error: "매장 삭제 권한이 없습니다",
        },
        { status: 403 }
      );
    }

    // 기존 데이터 백업 (감사 로그용)
    const oldValues = { ...store };

    // 매장 상태를 ARCHIVED로 변경 (소프트 삭제)
    const { data: archivedStore, error: archiveError } = await supabase
      .from("stores")
      .update({ status: "ARCHIVED" })
      .eq("id", storeId)
      .select("*")
      .single();

    if (archiveError) {
      console.error("매장 보관 오류:", archiveError);
      return NextResponse.json(
        {
          success: false,
          error: "매장 보관에 실패했습니다",
        },
        { status: 500 }
      );
    }

    // 감사 로그 기록 (선택적)
    try {
      await supabase.rpc("log_store_audit", {
        p_store_id: storeId,
        p_action: "ARCHIVE",
        p_table_name: "stores",
        p_old_values: oldValues,
        p_new_values: archivedStore,
      });
    } catch (auditError) {
      console.warn("감사 로그 기록 실패:", auditError);
    }

    return NextResponse.json({
      success: true,
      data: archivedStore,
      message: "매장이 성공적으로 보관되었습니다",
    });
  } catch (error) {
    console.error("매장 보관 API 오류:", error);
    return NextResponse.json(
      {
        success: false,
        error: "서버 오류가 발생했습니다",
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
  return withAuth(async (req, context) => {
    return getStore(req, { ...context, params });
  })(request);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  return withAuth(async (req, context) => {
    return updateStore(req, { ...context, params: resolvedParams });
  })(request);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  return withAuth(async (req, context) => {
    return deleteStore(req, { ...context, params: resolvedParams });
  })(request);
}
