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

    // 주 범위 계산 (로컬 타임존 사용)
    const sourceWeekStart = startOfWeek(new Date(source_week_start + "T00:00:00"), {
      weekStartsOn: 1,
    });
    const sourceWeekEnd = endOfWeek(new Date(source_week_start + "T00:00:00"), {
      weekStartsOn: 1,
    });
    const targetWeekStart = startOfWeek(new Date(target_week_start + "T00:00:00"), {
      weekStartsOn: 1,
    });
    const targetWeekEnd = endOfWeek(new Date(target_week_start + "T00:00:00"), {
      weekStartsOn: 1,
    });

    // 요일 차이 계산 (월요일 기준)
    const dayDifference = differenceInDays(targetWeekStart, sourceWeekStart);

    // 날짜 문자열 변환 (YYYY-MM-DD 형식, 로컬 타임존 기준)
    const formatDateStr = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    const sourceWeekStartStr = formatDateStr(sourceWeekStart);
    const sourceWeekEndStr = formatDateStr(sourceWeekEnd);
    const targetWeekStartStr = formatDateStr(targetWeekStart);
    const targetWeekEndStr = formatDateStr(targetWeekEnd);

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

    // 대상 주의 기존 스케줄 조회 및 삭제
    // 소스 주와 타겟 주가 다른 경우에만 삭제 수행
    let existingAssignments: Array<{ id: string; date: string }> = [];
    
    if (dayDifference !== 0) {
      // 소스 주와 타겟 주가 다른 경우에만 타겟 주의 모든 스케줄 삭제
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

      // 타겟 주의 모든 스케줄 삭제 (소스 주의 스케줄을 복사하기 전에)
      if (existingAssignments.length > 0) {
        const deleteIds = existingAssignments.map((a) => a.id);

        console.log("삭제할 스케줄:", {
          count: deleteIds.length,
          ids: deleteIds,
          dates: existingAssignments.map((a) => a.date),
        });

        // 배치 삭제 (Supabase는 최대 1000개까지 한 번에 삭제 가능)
        const batchSize = 1000;
        for (let i = 0; i < deleteIds.length; i += batchSize) {
          const batch = deleteIds.slice(i, i + batchSize);
          const { error: deleteError } = await supabase
            .from("schedule_assignments")
            .delete()
            .in("id", batch);

          if (deleteError) {
            console.error("기존 스케줄 삭제 오류:", {
              error: deleteError,
              batchIndex: i,
              batchSize: batch.length,
            });
            return NextResponse.json(
              { success: false, error: "Failed to delete existing assignments" },
              { status: 500 }
            );
          }
        }

        console.log("타겟 주 스케줄 삭제 완료:", {
          deletedCount: deleteIds.length,
        });
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
    // 각 요일별로 정확히 매핑하기 위해 소스 주의 각 날짜를 타겟 주의 해당 요일로 매핑
    const newAssignments = sourceAssignments
      .filter((assignment) => {
        // work_items나 store_users가 없는 스케줄은 제외
        // Supabase join 결과는 객체이므로 null 체크
        const hasWorkItem = assignment.work_items !== null && assignment.work_items !== undefined;
        const hasStoreUser = assignment.store_users !== null && assignment.store_users !== undefined;
        
        if (!hasWorkItem || !hasStoreUser) {
          console.log("스케줄 필터링 제외:", {
            date: assignment.date,
            hasWorkItem,
            hasStoreUser,
            work_items: assignment.work_items,
            store_users: assignment.store_users,
          });
        }
        
        return hasWorkItem && hasStoreUser;
      })
      .map((assignment) => {
        // 소스 날짜를 Date 객체로 변환 (로컬 타임존 사용)
        const sourceDateStr = assignment.date;
        const [year, month, day] = sourceDateStr.split("-").map(Number);
        const sourceDate = new Date(year, month - 1, day);
        
        // 소스 주의 시작일로부터 몇 번째 날인지 계산 (0 = 월요일, 6 = 일요일)
        const sourceDayOfWeek = (sourceDate.getDay() + 6) % 7; // 월요일을 0으로 변환
        
        // 타겟 주의 시작일에서 해당 요일로 이동 (로컬 타임존 사용)
        const targetDate = new Date(targetWeekStart);
        targetDate.setDate(targetWeekStart.getDate() + sourceDayOfWeek);
        
        // YYYY-MM-DD 형식으로 변환 (로컬 타임존 기준)
        const targetYear = targetDate.getFullYear();
        const targetMonth = String(targetDate.getMonth() + 1).padStart(2, "0");
        const targetDay = String(targetDate.getDate()).padStart(2, "0");
        const targetDateStr = `${targetYear}-${targetMonth}-${targetDay}`;

        console.log("스케줄 복사 매핑:", {
          sourceDate: assignment.date,
          sourceDayOfWeek,
          targetDate: targetDateStr,
          dayDifference,
          user_id: assignment.user_id,
          work_item_id: assignment.work_item_id,
          start_time: assignment.start_time,
          end_time: assignment.end_time,
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

    console.log("복사할 스케줄 개수:", {
      sourceCount: sourceAssignments?.length || 0,
      filteredCount: newAssignments.length,
      newAssignments: newAssignments.map((a) => ({
        date: a.date,
        user_id: a.user_id,
        work_item_id: a.work_item_id,
      })),
    });

    // 복사할 스케줄이 없으면 여기서 종료
    if (newAssignments.length === 0) {
      console.log("필터링 후 복사할 스케줄이 없음");
      return NextResponse.json({
        success: true,
        message: "No valid schedules to copy after filtering",
        copied_count: 0,
        deleted_count: existingAssignments?.length || 0,
      });
    }

    // 배치 삽입
    const { data: insertedAssignments, error: insertError } = await supabase
      .from("schedule_assignments")
      .insert(newAssignments)
      .select();

    if (insertError) {
      console.error("스케줄 복사 삽입 오류:", {
        error: insertError,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
        code: insertError.code,
        newAssignmentsCount: newAssignments.length,
        firstAssignment: newAssignments[0],
      });
      return NextResponse.json(
        { 
          success: false, 
          error: insertError.message || "Failed to insert assignments",
          details: insertError.details,
        },
        { status: 500 }
      );
    }

    console.log("스케줄 복사 완료:", {
      insertedCount: insertedAssignments?.length || 0,
      deletedCount: existingAssignments?.length || 0,
    });

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

