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
  has_time_restriction: z.boolean().optional(),
  start_time: z.string().optional(), // HH:mm 형식
  end_time: z.string().optional(), // HH:mm 형식
}).refine(
  (data) => {
    // has_time_restriction이 true인 경우 start_time과 end_time이 필수
    if (data.has_time_restriction === true) {
      return data.start_time !== undefined && data.end_time !== undefined;
    }
    return true;
  },
  {
    message: "시간 제한이 활성화된 경우 시작 시간과 종료 시간이 필요합니다",
  }
);

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
    // user_id가 제공된 경우 store_users.id로 변환
    let finalUserId = user_id;
    if (user_id) {
      // 먼저 store_users.id로 직접 조회
      let { data: storeUser } = await supabase
        .from("store_users")
        .select("id")
        .eq("id", user_id)
        .eq("store_id", store_id)
        .single();

      // store_users.id로 찾지 못한 경우, auth.users.id일 수 있으므로 user_id로 조회
      if (!storeUser) {
        const { data: storeUserByUserId } = await supabase
          .from("store_users")
          .select("id")
          .eq("user_id", user_id)
          .eq("store_id", store_id)
          .eq("is_guest", false)
          .eq("is_active", true)
          .single();

        if (storeUserByUserId) {
          finalUserId = storeUserByUserId.id;
        }
      }
    }

    // store_users와 조인하여 사용자 이름 가져오기
    let query = supabase
      .from("user_availability")
      .select(`
        *,
        store_users!inner(
          id,
          name,
          user_id,
          is_guest
        )
      `)
      .eq("store_id", store_id);

    // 날짜 범위 필터
    if (from) {
      query = query.gte("date", from);
    }
    if (to) {
      query = query.lte("date", to);
    }

    // 사용자 필터
    if (finalUserId) {
      query = query.eq("user_id", finalUserId);
    }

    const { data, error } = await query.order("date", { ascending: true });

    if (error) {
      console.error("출근 불가 조회 오류:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // 사용자 이름 조회 (store_users에 이름이 없으면 auth.users에서 조회)
    const userIds = data?.map((a: any) => a.store_users?.user_id).filter(Boolean) || [];
    let userNamesMap: Record<string, string> = {};
    
    if (userIds.length > 0) {
      const { data: users } = await supabase.auth.admin.listUsers();
      if (users) {
        users.users.forEach((u) => {
          const name = u.user_metadata?.name || u.email || "";
          userNamesMap[u.id] = name;
        });
      }
    }

    // 데이터 변환
    const transformedData =
      data?.map((availability: any) => {
        const storeUser = availability.store_users;
        let userName = "";
        
        if (storeUser) {
          if (storeUser.is_guest) {
            // 게스트 사용자는 store_users.name 사용
            userName = storeUser.name || "";
          } else if (storeUser.user_id) {
            // 일반 사용자는 auth.users에서 이름 가져오기
            userName = userNamesMap[storeUser.user_id] || "";
          }
        }
        
        return {
          id: availability.id,
          storeId: availability.store_id,
          userId: availability.user_id,
          userName: userName,
          date: availability.date,
          reason: availability.reason,
          hasTimeRestriction: availability.has_time_restriction || false,
          startTime: availability.start_time || null,
          endTime: availability.end_time || null,
          createdAt: availability.created_at,
          updatedAt: availability.updated_at,
        };
      }) || [];

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

  const { store_id, user_id, date, reason, has_time_restriction, start_time, end_time } = parsed.data;

  try {
    // user_id가 "current"인 경우 현재 사용자 ID로 대체
    let targetAuthUserId = user_id === "current" ? user.user.id : user_id;

    // user_id를 store_users.id로 변환 (Guest 사용자 포함)
    // 먼저 store_users.id로 직접 조회
    let { data: storeUser, error: storeUserError } = await supabase
      .from("store_users")
      .select("id, name, is_guest, is_active, user_id")
      .eq("id", targetAuthUserId)
      .eq("store_id", store_id)
      .single();

    // store_users.id로 찾지 못한 경우, 일반 유저일 수 있으므로 user_id로 조회
    if (storeUserError || !storeUser) {
      // 일반 유저의 경우: user_id가 auth.users.id일 수 있음
      // store_users 테이블에서 user_id로 조회
      const { data: storeUserByUserId, error: storeUserByUserIdError } = await supabase
        .from("store_users")
        .select("id, name, is_guest, is_active, user_id")
        .eq("user_id", targetAuthUserId)
        .eq("store_id", store_id)
        .eq("is_guest", false)
        .eq("is_active", true)
        .single();

      if (storeUserByUserId && !storeUserByUserIdError) {
        storeUser = storeUserByUserId;
        storeUserError = null;
      } else {
        // store_users에 레코드가 없는 경우, user_store_roles에서 역할 정보를 가져와서 생성
        const { data: userRole, error: userRoleError } = await supabase
          .from("user_store_roles")
          .select("role, status")
          .eq("user_id", targetAuthUserId)
          .eq("store_id", store_id)
          .eq("status", "ACTIVE")
          .single();

        if (userRole && !userRoleError) {
          // store_users 레코드 생성
          const { data: newStoreUser, error: createError } = await supabase
            .from("store_users")
            .insert({
              store_id: store_id,
              user_id: targetAuthUserId,
              role: userRole.role,
              is_guest: false,
              is_active: true,
              granted_by: user.user.id,
            })
            .select("id, name, is_guest, is_active, user_id")
            .single();

          if (newStoreUser && !createError) {
            storeUser = newStoreUser;
            storeUserError = null;
          }
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

    // 권한 확인: 본인 또는 매장 관리자만 등록 가능
    const isOwnData = user.user.id === targetAuthUserId;
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
      .eq("user_id", finalUserId)
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
    const upsertData: any = {
      store_id,
      user_id: finalUserId,
      date,
      reason,
      created_by: user.user.id,
    };

    if (has_time_restriction === true) {
      upsertData.has_time_restriction = true;
      upsertData.start_time = start_time;
      upsertData.end_time = end_time;
    } else {
      upsertData.has_time_restriction = false;
      upsertData.start_time = null;
      upsertData.end_time = null;
    }

    const { data: newAvailability, error: insertError } = await supabase
      .from("user_availability")
      .upsert(upsertData)
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
  let targetAuthUserId = user_id === "current" ? user.user.id : user_id;

  try {
    // user_id를 store_users.id로 변환 (Guest 사용자 포함)
    // 먼저 store_users.id로 직접 조회
    let { data: storeUser, error: storeUserError } = await supabase
      .from("store_users")
      .select("id, name, is_guest, is_active, user_id")
      .eq("id", targetAuthUserId)
      .eq("store_id", store_id)
      .single();

    // store_users.id로 찾지 못한 경우, 일반 유저일 수 있으므로 user_id로 조회
    if (storeUserError || !storeUser) {
      // 일반 유저의 경우: user_id가 auth.users.id일 수 있음
      // store_users 테이블에서 user_id로 조회
      const { data: storeUserByUserId, error: storeUserByUserIdError } = await supabase
        .from("store_users")
        .select("id, name, is_guest, is_active, user_id")
        .eq("user_id", targetAuthUserId)
        .eq("store_id", store_id)
        .eq("is_guest", false)
        .eq("is_active", true)
        .single();

      if (storeUserByUserId && !storeUserByUserIdError) {
        storeUser = storeUserByUserId;
        storeUserError = null;
      }
    }

    if (storeUserError || !storeUser) {
      return NextResponse.json(
        { success: false, error: "Invalid user or user not found in store" },
        { status: 400 }
      );
    }

    // user_id를 store_users.id로 사용 (일반 유저의 경우 변환됨)
    const finalUserId = storeUser.id;

    // 권한 확인: 본인 또는 매장 관리자만 삭제 가능
    const isOwnData = user.user.id === targetAuthUserId;
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
      .eq("user_id", finalUserId)
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
