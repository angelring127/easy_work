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
          unpaid_break_min,
          role_hint
        ),
        store_users!inner(
          id,
          name,
          user_id,
          is_guest,
          role
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
      data?.map((assignment) => {
        const storeUser = assignment.store_users;
        const userName = storeUser?.name || "Unknown User";
        const userRoles = storeUser?.role ? [storeUser.role] : [];
        
        return {
          id: assignment.id,
          storeId: assignment.store_id,
          userId: assignment.user_id,
          userName: userName,
          workItemId: assignment.work_item_id,
          workItemName: assignment.work_items?.name,
          date: assignment.date,
          startTime: assignment.start_time,
          endTime: assignment.end_time,
          status: assignment.status,
          notes: assignment.notes,
          createdAt: assignment.created_at,
          updatedAt: assignment.updated_at,
          requiredRoles: assignment.work_items?.role_hint 
            ? (Array.isArray(assignment.work_items.role_hint) 
                ? assignment.work_items.role_hint 
                : [assignment.work_items.role_hint])
            : [],
          userRoles: userRoles,
          unpaidBreakMin: assignment.work_items?.unpaid_break_min || 0,
        };
      }) || [];

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

    if (roleError || !userRole || !["MASTER", "SUB", "SUB_MANAGER"].includes(userRole.role)) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // user_id가 store_users.id인지 확인 (Guest 사용자 포함)
    // 먼저 store_users.id로 직접 조회
    let { data: storeUser, error: storeUserError } = await supabase
      .from("store_users")
      .select("id, name, is_guest, is_active, user_id")
      .eq("id", user_id)
      .eq("store_id", store_id)
      .single();

    console.log("POST 스케줄 배정 - user_id 확인:", {
      userId: user_id,
      storeId: store_id,
      storeUserError,
      storeUser,
    });

    // store_users.id로 찾지 못한 경우, 일반 유저일 수 있으므로 user_id로 조회
    if (storeUserError || !storeUser) {
      // 일반 유저의 경우: user_id가 auth.users.id일 수 있음
      // store_users 테이블에서 user_id로 조회
      const { data: storeUserByUserId, error: storeUserByUserIdError } = await supabase
        .from("store_users")
        .select("id, name, is_guest, is_active, user_id")
        .eq("user_id", user_id)
        .eq("store_id", store_id)
        .eq("is_guest", false)
        .eq("is_active", true)
        .single();

      if (storeUserByUserId && !storeUserByUserIdError) {
        console.log("POST 스케줄 배정 - store_users에서 user_id로 찾음:", storeUserByUserId);
        storeUser = storeUserByUserId;
        storeUserError = null;
      } else {
        console.log("POST 스케줄 배정 - store_users에 레코드가 없음, user_store_roles에서 확인:", {
          userId: user_id,
          storeId: store_id,
        });
        // store_users에 레코드가 없는 경우, user_store_roles에서 역할 정보를 가져와서 생성
        const { data: userRole, error: userRoleError } = await supabase
          .from("user_store_roles")
          .select("role, status")
          .eq("user_id", user_id)
          .eq("store_id", store_id)
          .eq("status", "ACTIVE")
          .single();

        if (userRole && !userRoleError) {
          console.log("POST 스케줄 배정 - user_store_roles 조회 결과:", userRole);
          // store_users 레코드 생성
          const { data: newStoreUser, error: createError } = await supabase
            .from("store_users")
            .insert({
              store_id: store_id,
              user_id: user_id,
              role: userRole.role,
              is_guest: false,
              is_active: true,
              granted_by: user.user.id,
            })
            .select("id, name, is_guest, is_active, user_id")
            .single();

          console.log("POST 스케줄 배정 - store_users 레코드 생성 결과:", { newStoreUser, createError });

          if (newStoreUser && !createError) {
            storeUser = newStoreUser;
            storeUserError = null;
          }
        } else {
          console.log("POST 스케줄 배정 - user_store_roles 조회 실패:", { userRole, userRoleError });
        }
      }
    }

    if (storeUserError || !storeUser || !storeUser.is_active) {
      return NextResponse.json(
        { success: false, error: "Invalid user or user not found in store" },
        { status: 400 }
      );
    }

    // user_id를 store_users.id로 사용 (일반 유저의 경우 변환됨)
    const finalUserId = storeUser.id;

    // 출근 불가 확인 (경고만 표시, 배정은 진행)
    const { data: availability, error: availabilityError } = await supabase
      .from("user_availability")
      .select("id, reason")
      .eq("store_id", store_id)
      .eq("user_id", finalUserId)
      .eq("date", date)
      .single();

    const isUnavailable = availability && !availabilityError;

    // 기존 배정이 있으면 삭제 후 새로 생성 (upsert 방식)
    const { data: existingAssignment, error: conflictError } = await supabase
      .from("schedule_assignments")
      .select("id")
      .eq("store_id", store_id)
      .eq("user_id", finalUserId)
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
        user_id: finalUserId,
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
      warning: isUnavailable
        ? "User is unavailable for this date"
        : undefined,
    });
  } catch (error) {
    console.error("스케줄 배정 생성 중 오류:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
