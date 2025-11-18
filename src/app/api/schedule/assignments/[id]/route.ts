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

    // 기존 스케줄의 user_id가 store_users.id인지 확인
    // 먼저 store_users.id로 직접 조회
    let { data: existingStoreUser, error: storeUserError } = await supabase
      .from("store_users")
      .select("id, user_id, is_guest, is_active")
      .eq("id", existingAssignment.user_id)
      .eq("store_id", existingAssignment.store_id)
      .single();

    console.log("기존 스케줄 user_id 확인:", {
      assignmentId: id,
      existingUserId: existingAssignment.user_id,
      storeId: existingAssignment.store_id,
      storeUserError,
      existingStoreUser,
    });

    // store_users.id로 찾지 못한 경우, 일반 유저의 auth.users.id일 수 있음
    if (storeUserError || !existingStoreUser) {
      // store_users 테이블에서 user_id로 조회
      const { data: storeUserByUserId, error: storeUserByUserIdError } = await supabase
        .from("store_users")
        .select("id, user_id, is_guest, is_active")
        .eq("user_id", existingAssignment.user_id)
        .eq("store_id", existingAssignment.store_id)
        .eq("is_guest", false)
        .eq("is_active", true)
        .single();

      if (storeUserByUserId && !storeUserByUserIdError) {
        console.log("store_users에서 user_id로 찾음:", storeUserByUserId);
        existingStoreUser = storeUserByUserId;
        storeUserError = null;
      } else {
        console.log("store_users에 레코드가 없음, user_store_roles에서 확인:", {
          userId: existingAssignment.user_id,
          storeId: existingAssignment.store_id,
        });
        // store_users에 레코드가 없는 경우, user_store_roles에서 역할 정보를 가져와서 생성
        const { data: userRole, error: userRoleError } = await supabase
          .from("user_store_roles")
          .select("role, status")
          .eq("user_id", existingAssignment.user_id)
          .eq("store_id", existingAssignment.store_id)
          .eq("status", "ACTIVE")
          .single();

        console.log("user_store_roles 조회 결과:", { userRole, userRoleError });

        if (userRole && !userRoleError) {
          // store_users 레코드 생성
          const { data: newStoreUser, error: createError } = await supabase
            .from("store_users")
            .insert({
              store_id: existingAssignment.store_id,
              user_id: existingAssignment.user_id,
              role: userRole.role,
              is_guest: false,
              is_active: true,
              granted_by: user.user.id,
            })
            .select("id, user_id, is_guest, is_active")
            .single();

          console.log("store_users 레코드 생성 결과:", { newStoreUser, createError });

          if (newStoreUser && !createError) {
            existingStoreUser = newStoreUser;
            storeUserError = null;
          }
        }
      }
    }

    // existingAssignment.user_id가 store_users.id가 아닌 경우 변환
    let finalUserId = existingAssignment.user_id;
    if (existingStoreUser) {
      if (existingStoreUser.id !== existingAssignment.user_id) {
        // store_users.id로 업데이트
        const { error: updateError } = await supabase
          .from("schedule_assignments")
          .update({ user_id: existingStoreUser.id })
          .eq("id", id);

        if (updateError) {
          console.error("스케줄 배정 user_id 업데이트 오류:", updateError);
        } else {
          // 메모리상의 existingAssignment도 업데이트
          finalUserId = existingStoreUser.id;
          existingAssignment.user_id = existingStoreUser.id;
        }
      } else {
        // 이미 store_users.id인 경우
        finalUserId = existingStoreUser.id;
      }
    } else {
      // existingStoreUser를 찾지 못한 경우 (데이터 불일치)
      console.error("기존 스케줄의 user_id에 해당하는 store_users 레코드를 찾을 수 없음:", {
        assignmentId: id,
        existingUserId: existingAssignment.user_id,
        storeId: existingAssignment.store_id,
      });
      return NextResponse.json(
        { success: false, error: "Invalid user or user not found in store" },
        { status: 400 }
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

    if (roleError || !userRole || !["MASTER", "SUB", "SUB_MANAGER"].includes(userRole.role)) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // 사용자 변경 시 user_id가 store_users.id인지 확인 (Guest 사용자 포함)
    // user_id가 제공되지 않았거나 변경되지 않은 경우, 기존 user_id 사용
    const targetUserId = parsed.data.user_id || finalUserId;
    
    // user_id가 제공되지 않은 경우, 기존 user_id (finalUserId) 사용
    if (!parsed.data.user_id) {
      parsed.data.user_id = finalUserId;
    }
    
    // user_id가 변경된 경우에만 검증
    if (parsed.data.user_id && parsed.data.user_id !== finalUserId) {
      // 먼저 store_users.id로 직접 조회
      let { data: storeUser, error: storeUserError } = await supabase
        .from("store_users")
        .select("id, name, is_guest, is_active, user_id")
        .eq("id", targetUserId)
        .eq("store_id", existingAssignment.store_id)
        .single();

      // store_users.id로 찾지 못한 경우, 일반 유저일 수 있으므로 user_id로 조회
      if (storeUserError || !storeUser) {
        const { data: storeUserByUserId, error: storeUserByUserIdError } = await supabase
          .from("store_users")
          .select("id, name, is_guest, is_active, user_id")
          .eq("user_id", targetUserId)
          .eq("store_id", existingAssignment.store_id)
          .eq("is_guest", false)
          .eq("is_active", true)
          .single();

        if (storeUserByUserId && !storeUserByUserIdError) {
          storeUser = storeUserByUserId;
          storeUserError = null;
          // user_id를 store_users.id로 변환
          parsed.data.user_id = storeUser.id;
        } else {
          // store_users에 레코드가 없는 경우, user_store_roles에서 역할 정보를 가져와서 생성
          const { data: userRole, error: userRoleError } = await supabase
            .from("user_store_roles")
            .select("role, status")
            .eq("user_id", targetUserId)
            .eq("store_id", existingAssignment.store_id)
            .eq("status", "ACTIVE")
            .single();

          if (userRole && !userRoleError) {
            // store_users 레코드 생성
            const { data: newStoreUser, error: createError } = await supabase
              .from("store_users")
              .insert({
                store_id: existingAssignment.store_id,
                user_id: targetUserId,
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
              // user_id를 store_users.id로 변환
              parsed.data.user_id = storeUser.id;
            }
          }
        }
      } else {
        // store_users.id로 찾은 경우, parsed.data.user_id 업데이트
        parsed.data.user_id = storeUser.id;
      }

      if (storeUserError || !storeUser || !storeUser.is_active) {
        return NextResponse.json(
          { success: false, error: "Invalid user or user not found in store" },
          { status: 400 }
        );
      }

      // 출근 불가 확인
      const { data: availability, error: availabilityError } = await supabase
        .from("user_availability")
        .select("id")
        .eq("store_id", existingAssignment.store_id)
        .eq("user_id", storeUser.id)
        .eq("date", existingAssignment.date)
        .single();

      if (availability && !availabilityError) {
        return NextResponse.json(
          { success: false, error: "User is unavailable for this date" },
          { status: 400 }
        );
      }
    }
    
    // user_id가 제공되지 않았거나 변경되지 않은 경우, finalUserId 사용
    if (!parsed.data.user_id) {
      parsed.data.user_id = finalUserId;
    }
    
    // existingStoreUser가 활성 상태인지 확인
    if (!existingStoreUser.is_active) {
      console.error("기존 스케줄의 user_id가 비활성 상태:", {
        assignmentId: id,
        existingUserId: existingAssignment.user_id,
        finalUserId,
        existingStoreUser,
      });
      return NextResponse.json(
        { success: false, error: "Invalid user or user not found in store" },
        { status: 400 }
      );
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

    if (roleError || !userRole || !["MASTER", "SUB", "SUB_MANAGER"].includes(userRole.role)) {
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
