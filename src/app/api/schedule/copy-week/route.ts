import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { startOfWeek, endOfWeek, eachDayOfInterval, differenceInDays } from "date-fns";

// 스케줄 복사 스키마
const CopyWeekSchema = z.object({
  store_id: z.string().uuid(),
  source_week_start: z.string(), // ISO date
  target_week_start: z.string(), // ISO date
});

/**
 * 주 단위 스케줄 복사
 * POST /api/schedule/copy-week
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const body = await request.json();
  const parsed = CopyWeekSchema.safeParse(body);

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

  const { store_id, source_week_start, target_week_start } = parsed.data;

  try {
    // 권한 확인: 매장 관리자만 복사 가능
    const { data: userRole, error: roleError } = await supabase
      .from("user_store_roles")
      .select("role")
      .eq("store_id", store_id)
      .eq("user_id", user.user.id)
      .eq("status", "ACTIVE")
      .single();

    if (
      roleError ||
      !userRole ||
      !["MASTER", "SUB", "SUB_MANAGER"].includes(userRole.role)
    ) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // 주 범위 계산
    const sourceWeekStart = startOfWeek(new Date(source_week_start), {
      weekStartsOn: 1,
    });
    const sourceWeekEnd = endOfWeek(new Date(source_week_start), {
      weekStartsOn: 1,
    });
    const targetWeekStart = startOfWeek(new Date(target_week_start), {
      weekStartsOn: 1,
    });
    const targetWeekEnd = endOfWeek(new Date(target_week_start), {
      weekStartsOn: 1,
    });

    // 요일 차이 계산 (월요일 기준)
    const dayDifference = differenceInDays(targetWeekStart, sourceWeekStart);

    // 날짜 문자열 변환 (YYYY-MM-DD 형식)
    const sourceWeekStartStr = sourceWeekStart.toISOString().split("T")[0];
    const sourceWeekEndStr = sourceWeekEnd.toISOString().split("T")[0];
    const targetWeekStartStr = targetWeekStart.toISOString().split("T")[0];
    const targetWeekEndStr = targetWeekEnd.toISOString().split("T")[0];

    console.log("스케줄 복사 시작:", {
      source_week_start: source_week_start,
      target_week_start: target_week_start,
      sourceWeekStartStr,
      sourceWeekEndStr,
      targetWeekStartStr,
      targetWeekEndStr,
      dayDifference,
    });

    // 소스 주의 스케줄을 먼저 조회 (삭제 전에 조회해야 함)
    // inner join 대신 left join 사용하여 모든 스케줄 조회
    const { data: sourceAssignments, error: sourceError } = await supabase
      .from("schedule_assignments")
      .select(
        `
        *,
        work_items(
          id,
          name
        ),
        store_users(
          id,
          name,
          user_id
        )
      `
      )
      .eq("store_id", store_id)
      .gte("date", sourceWeekStartStr)
      .lte("date", sourceWeekEndStr)
      .eq("status", "ASSIGNED");

    if (sourceError) {
      console.error("소스 스케줄 조회 오류:", sourceError);
      return NextResponse.json(
        { success: false, error: "Failed to fetch source assignments" },
        { status: 500 }
      );
    }

    console.log("소스 스케줄 조회 결과:", {
      count: sourceAssignments?.length || 0,
      dates: sourceAssignments?.map((a) => a.date) || [],
    });

    // 대상 주의 기존 스케줄 조회 및 삭제 (target 주만 삭제, 소스 주는 제외)
    // 소스 주와 타겟 주가 다른 경우에만 삭제 수행
    let existingAssignments: Array<{ id: string; date: string }> = [];
    
    if (dayDifference !== 0) {
      // 소스 주와 타겟 주가 다른 경우에만 타겟 주의 스케줄 삭제
      const { data: targetAssignments, error: fetchError } = await supabase
        .from("schedule_assignments")
        .select("id, date")
        .eq("store_id", store_id)
        .gte("date", targetWeekStartStr)
        .lte("date", targetWeekEndStr)
        .eq("status", "ASSIGNED");

      if (fetchError) {
        console.error("기존 스케줄 조회 오류:", fetchError);
        return NextResponse.json(
          { success: false, error: "Failed to fetch existing assignments" },
          { status: 500 }
        );
      }

      existingAssignments = targetAssignments || [];

      console.log("타겟 주 스케줄 조회 결과 (삭제 대상):", {
        count: existingAssignments.length,
        dates: existingAssignments.map((a) => a.date),
        targetWeekStartStr,
        targetWeekEndStr,
      });

      // 타겟 주의 스케줄 삭제 (소스 주 범위는 제외)
      if (existingAssignments.length > 0) {
        const deleteIds = existingAssignments
          .filter((a) => {
            // 타겟 주에 있지만 소스 주에는 없는 스케줄만 삭제
            const assignmentDate = a.date;
            const isInSourceWeek =
              assignmentDate >= sourceWeekStartStr &&
              assignmentDate <= sourceWeekEndStr;
            
            // 소스 주에 있지 않은 경우만 삭제
            return !isInSourceWeek;
          })
          .map((a) => a.id);

        console.log("삭제할 스케줄 ID:", deleteIds);

        if (deleteIds.length > 0) {
          const { error: deleteError } = await supabase
            .from("schedule_assignments")
            .delete()
            .in("id", deleteIds);

          if (deleteError) {
            console.error("기존 스케줄 삭제 오류:", deleteError);
            return NextResponse.json(
              { success: false, error: "Failed to delete existing assignments" },
              { status: 500 }
            );
          }
        }
      }
    } else {
      console.log("소스 주와 타겟 주가 같아서 삭제하지 않음");
    }

    // 복사할 스케줄이 없으면 여기서 종료
    if (!sourceAssignments || sourceAssignments.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No schedules to copy",
        copied_count: 0,
        deleted_count: existingAssignments?.length || 0,
      });
    }

    // 새 스케줄 생성 (요일 매핑)
    const newAssignments = sourceAssignments
      .filter((assignment) => {
        // work_items나 store_users가 없는 스케줄은 제외
        return assignment.work_items && assignment.store_users;
      })
      .map((assignment) => {
        // 날짜를 더 정확하게 계산
        const sourceDate = new Date(assignment.date + "T00:00:00");
        const targetDate = new Date(sourceDate);
        targetDate.setDate(targetDate.getDate() + dayDifference);

        const targetDateStr = targetDate.toISOString().split("T")[0];

        console.log("스케줄 복사 매핑:", {
          sourceDate: assignment.date,
          targetDate: targetDateStr,
          dayDifference,
          user_id: assignment.user_id,
          work_item_id: assignment.work_item_id,
        });

        return {
          store_id: assignment.store_id,
          user_id: assignment.user_id,
          work_item_id: assignment.work_item_id,
          date: targetDateStr,
          start_time: assignment.start_time,
          end_time: assignment.end_time,
          status: "ASSIGNED" as const,
          notes: assignment.notes || null,
          created_by: user.user.id,
        };
      });

    // 배치 삽입
    const { data: insertedAssignments, error: insertError } = await supabase
      .from("schedule_assignments")
      .insert(newAssignments)
      .select();

    if (insertError) {
      console.error("스케줄 복사 오류:", insertError);
      return NextResponse.json(
        { success: false, error: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Schedule copied successfully",
      copied_count: insertedAssignments?.length || 0,
      deleted_count: existingAssignments?.length || 0,
    });
  } catch (error) {
    console.error("스케줄 복사 중 오류:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

