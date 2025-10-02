import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

// 출근 불가 조회 스키마
// NOTE: GET 파라미터는 느슨하게 처리

// 출근 불가 생성/수정 스키마
const CreateAvailabilitySchema = z.object({
  store_id: z.string(),
  user_id: z.string(),
  date: z.string(), // ISO date
  reason: z.string().optional(),
});

/**
 * 출근 불가 조회
 * GET /api/schedule/availability
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const { searchParams } = new URL(request.url);
  const store_id = searchParams.get("store_id");
  const from = searchParams.get("from") || undefined;
  const to = searchParams.get("to") || undefined;
  const user_id = searchParams.get("user_id") || undefined;
  if (!store_id) {
    return NextResponse.json(
      { success: false, error: "store_id required" },
      { status: 400 }
    );
  }

  const { data: user, error: authError } = await supabase.auth.getUser();
  if (authError || !user.user) {
    return NextResponse.json(
      { success: false, error: "unauthorized" },
      { status: 401 }
    );
  }

  try {
    let query = supabase
      .from("user_availability")
      .select(`*`)
      .eq("store_id", store_id);

    // 날짜 범위 필터
    if (from) {
      query = query.gte("date", from);
    }
    if (to) {
      query = query.lte("date", to);
    }

    // 사용자 필터
    if (user_id) {
      query = query.eq("user_id", user_id);
    }

    const { data, error } = await query.order("date", { ascending: true });

    if (error) {
      console.error("출근 불가 조회 오류:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // 데이터 변환
    const transformedData =
      data?.map((availability) => ({
        id: availability.id,
        storeId: availability.store_id,
        userId: availability.user_id,
        userName: "",
        date: availability.date,
        reason: availability.reason,
        createdAt: availability.created_at,
        updatedAt: availability.updated_at,
      })) || [];

    return NextResponse.json({
      success: true,
      data: transformedData,
    });
  } catch (error) {
    console.error("출근 불가 조회 중 오류:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * 출근 불가 등록
 * POST /api/schedule/availability
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const body = await request.json();
  console.log("Availability POST body:", body);
  const parsed = CreateAvailabilitySchema.safeParse(body);

  if (!parsed.success) {
    console.log("Availability POST validation error:", parsed.error.flatten());
    return NextResponse.json(
      { success: false, error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { data: user, error: authError } = await supabase.auth.getUser();
  if (authError || !user.user) {
    return NextResponse.json(
      { success: false, error: "unauthorized" },
      { status: 401 }
    );
  }

  const { store_id, user_id, date, reason } = parsed.data;

  try {
    // user_id가 "current"인 경우 현재 사용자 ID로 대체
    const actualUserId = user_id === "current" ? user.user.id : user_id;

    // 권한 확인: 본인 또는 매장 관리자만 등록 가능
    const isOwnData = user.user.id === actualUserId;
    const isManager = await checkManagerPermission(
      supabase,
      store_id,
      user.user.id
    );

    if (!isOwnData && !isManager) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // 기존 배정 확인
    const { data: existingAssignment, error: assignmentError } = await supabase
      .from("schedule_assignments")
      .select("id")
      .eq("store_id", store_id)
      .eq("user_id", actualUserId)
      .eq("date", date)
      .eq("status", "ASSIGNED")
      .single();

    if (existingAssignment && !assignmentError) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Cannot mark as unavailable: user already has assignments for this date",
        },
        { status: 400 }
      );
    }

    // 출근 불가 등록 (upsert 사용)
    const { data: newAvailability, error: insertError } = await supabase
      .from("user_availability")
      .upsert({
        store_id,
        user_id: actualUserId,
        date,
        reason,
        created_by: user.user.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error("출근 불가 등록 오류:", insertError);
      return NextResponse.json(
        { success: false, error: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: newAvailability,
    });
  } catch (error) {
    console.error("출근 불가 등록 중 오류:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * 출근 불가 삭제
 * DELETE /api/schedule/availability
 */
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();

  const { searchParams } = new URL(request.url);
  const store_id = searchParams.get("store_id");
  const user_id = searchParams.get("user_id");
  const date = searchParams.get("date");

  if (!store_id || !user_id || !date) {
    return NextResponse.json(
      { success: false, error: "store_id, user_id, and date are required" },
      { status: 400 }
    );
  }

  const { data: user, error: authError } = await supabase.auth.getUser();
  if (authError || !user.user) {
    return NextResponse.json(
      { success: false, error: "unauthorized" },
      { status: 401 }
    );
  }

  // user_id가 "current"인 경우 현재 사용자 ID로 대체
  const actualUserId = user_id === "current" ? user.user.id : user_id;

  try {
    // 권한 확인: 본인 또는 매장 관리자만 삭제 가능
    const isOwnData = user.user.id === actualUserId;
    const isManager = await checkManagerPermission(
      supabase,
      store_id,
      user.user.id
    );

    if (!isOwnData && !isManager) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // 출근 불가 삭제
    const { error: deleteError } = await supabase
      .from("user_availability")
      .delete()
      .eq("store_id", store_id)
      .eq("user_id", actualUserId)
      .eq("date", date);

    if (deleteError) {
      console.error("출근 불가 삭제 오류:", deleteError);
      return NextResponse.json(
        { success: false, error: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Availability removed successfully",
    });
  } catch (error) {
    console.error("출근 불가 삭제 중 오류:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// 매장 관리자 권한 확인 헬퍼 함수
async function checkManagerPermission(
  supabase: any,
  store_id: string,
  user_id: string
): Promise<boolean> {
  const { data: userRole, error } = await supabase
    .from("user_store_roles")
    .select("role")
    .eq("store_id", store_id)
    .eq("user_id", user_id)
    .eq("status", "ACTIVE")
    .single();

  return !error && userRole && ["MASTER", "SUB"].includes(userRole.role);
}
