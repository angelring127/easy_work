import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

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
 * 스케줄 배정 수정
 * PATCH /api/schedule/assignments/[id]
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await context.params;

  const body = await request.json();
  const parsed = UpdateAssignmentSchema.safeParse(body);

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

  try {
    // 기존 배정 조회
    const { data: existingAssignment, error: fetchError } = await supabase
      .from("schedule_assignments")
      .select("store_id, user_id, date")
      .eq("id", id)
      .single();

    if (fetchError || !existingAssignment) {
      return NextResponse.json(
        { success: false, error: "Assignment not found" },
        { status: 404 }
      );
    }

    // 권한 확인: 매장 관리자만 수정 가능
    const { data: userRole, error: roleError } = await supabase
      .from("user_store_roles")
      .select("role")
      .eq("store_id", existingAssignment.store_id)
      .eq("user_id", user.user.id)
      .eq("status", "ACTIVE")
      .single();

    if (roleError || !userRole || !["MASTER", "SUB"].includes(userRole.role)) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // 사용자 변경 시 출근 불가 확인
    if (
      parsed.data.user_id &&
      parsed.data.user_id !== existingAssignment.user_id
    ) {
      const { data: availability, error: availabilityError } = await supabase
        .from("user_availability")
        .select("id")
        .eq("store_id", existingAssignment.store_id)
        .eq("user_id", parsed.data.user_id)
        .eq("date", existingAssignment.date)
        .single();

      if (availability && !availabilityError) {
        return NextResponse.json(
          { success: false, error: "User is unavailable for this date" },
          { status: 400 }
        );
      }
    }

    // 스케줄 배정 수정
    const { data: updatedAssignment, error: updateError } = await supabase
      .from("schedule_assignments")
      .update(parsed.data)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("스케줄 배정 수정 오류:", updateError);
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedAssignment,
    });
  } catch (error) {
    console.error("스케줄 배정 수정 중 오류:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * 스케줄 배정 삭제
 * DELETE /api/schedule/assignments/[id]
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await context.params;

  const { data: user, error: authError } = await supabase.auth.getUser();
  if (authError || !user.user) {
    return NextResponse.json(
      { success: false, error: "unauthorized" },
      { status: 401 }
    );
  }

  try {
    // 기존 배정 조회
    const { data: existingAssignment, error: fetchError } = await supabase
      .from("schedule_assignments")
      .select("store_id")
      .eq("id", id)
      .single();

    if (fetchError || !existingAssignment) {
      return NextResponse.json(
        { success: false, error: "Assignment not found" },
        { status: 404 }
      );
    }

    // 권한 확인: 매장 관리자만 삭제 가능
    const { data: userRole, error: roleError } = await supabase
      .from("user_store_roles")
      .select("role")
      .eq("store_id", existingAssignment.store_id)
      .eq("user_id", user.user.id)
      .eq("status", "ACTIVE")
      .single();

    if (roleError || !userRole || !["MASTER", "SUB"].includes(userRole.role)) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // 스케줄 배정 삭제
    const { error: deleteError } = await supabase
      .from("schedule_assignments")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("스케줄 배정 삭제 오류:", deleteError);
      return NextResponse.json(
        { success: false, error: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Assignment deleted successfully",
    });
  } catch (error) {
    console.error("스케줄 배정 삭제 중 오류:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
