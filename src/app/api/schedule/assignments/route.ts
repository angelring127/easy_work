import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

// 스케줄 배정 조회 스키마
// NOTE: GET 파라미터는 느슨하게 처리 (유효하지 않으면 이후에서 가드)

// 스케줄 배정 생성 스키마
const CreateAssignmentSchema = z.object({
  store_id: z.string().uuid(),
  user_id: z.string().uuid(),
  work_item_id: z.string().uuid(),
  date: z.string(), // ISO date
  start_time: z.string(), // HH:mm format
  end_time: z.string(), // HH:mm format
  notes: z.string().optional(),
});

// 스케줄 배정 수정 스키마
const UpdateAssignmentSchema = z.object({
  user_id: z.string().uuid().optional(),
  work_item_id: z.string().uuid().optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  status: z.enum(["ASSIGNED", "CONFIRMED", "CANCELLED"]).optional(),
  notes: z.string().optional(),
});

/**
 * 스케줄 배정 조회
 * GET /api/schedule/assignments
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const { searchParams } = new URL(request.url);
  const store_id = searchParams.get("store_id");
  const from = searchParams.get("from") || undefined;
  const to = searchParams.get("to") || undefined;
  const user_id = searchParams.get("user_id") || undefined;
  const work_item_id = searchParams.get("work_item_id") || undefined;
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
      .from("schedule_assignments")
      .select(
        `
        *,
        work_items!inner(
          id,
          name,
          start_min,
          end_min,
          role_hint
        )
      `
      )
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

    // 근무 항목 필터
    if (work_item_id) {
      query = query.eq("work_item_id", work_item_id);
    }

    const { data, error } = await query
      .order("date", { ascending: true })
      .order("start_time", { ascending: true });

    if (error) {
      console.error("스케줄 배정 조회 오류:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // 데이터 변환
    const transformedData =
      data?.map((assignment) => ({
        id: assignment.id,
        storeId: assignment.store_id,
        userId: assignment.user_id,
        userName: "",
        workItemId: assignment.work_item_id,
        workItemName: assignment.work_items?.name,
        date: assignment.date,
        startTime: assignment.start_time,
        endTime: assignment.end_time,
        status: assignment.status,
        notes: assignment.notes,
        createdAt: assignment.created_at,
        updatedAt: assignment.updated_at,
      })) || [];

    return NextResponse.json({
      success: true,
      data: transformedData,
    });
  } catch (error) {
    console.error("스케줄 배정 조회 중 오류:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * 스케줄 배정 생성
 * POST /api/schedule/assignments
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const body = await request.json();
  const parsed = CreateAssignmentSchema.safeParse(body);

  if (!parsed.success) {
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

  const { store_id, user_id, work_item_id, date, start_time, end_time, notes } =
    parsed.data;

  try {
    // 권한 확인: 매장 관리자만 배정 가능
    const { data: userRole, error: roleError } = await supabase
      .from("user_store_roles")
      .select("role")
      .eq("store_id", store_id)
      .eq("user_id", user.user.id)
      .eq("status", "ACTIVE")
      .single();

    if (roleError || !userRole || !["MASTER", "SUB"].includes(userRole.role)) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // 출근 불가 확인
    const { data: availability, error: availabilityError } = await supabase
      .from("user_availability")
      .select("id")
      .eq("store_id", store_id)
      .eq("user_id", user_id)
      .eq("date", date)
      .single();

    if (availability && !availabilityError) {
      return NextResponse.json(
        { success: false, error: "User is unavailable for this date" },
        { status: 400 }
      );
    }

    // 기존 배정이 있으면 삭제 후 새로 생성 (upsert 방식)
    const { data: existingAssignment, error: conflictError } = await supabase
      .from("schedule_assignments")
      .select("id")
      .eq("store_id", store_id)
      .eq("user_id", user_id)
      .eq("date", date)
      .eq("status", "ASSIGNED")
      .single();

    if (existingAssignment && !conflictError) {
      // 기존 스케줄 삭제
      const { error: deleteError } = await supabase
        .from("schedule_assignments")
        .delete()
        .eq("id", existingAssignment.id);

      if (deleteError) {
        console.error("기존 스케줄 삭제 오류:", deleteError);
        return NextResponse.json(
          { success: false, error: "Failed to delete existing assignment" },
          { status: 500 }
        );
      }
    }

    // 스케줄 배정 생성
    const { data: newAssignment, error: insertError } = await supabase
      .from("schedule_assignments")
      .insert({
        store_id,
        user_id,
        work_item_id,
        date,
        start_time,
        end_time,
        notes,
        created_by: user.user.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error("스케줄 배정 생성 오류:", insertError);
      return NextResponse.json(
        { success: false, error: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: newAssignment,
    });
  } catch (error) {
    console.error("스케줄 배정 생성 중 오류:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
