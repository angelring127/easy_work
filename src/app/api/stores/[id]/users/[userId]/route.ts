import { NextRequest, NextResponse } from "next/server";
import { checkAuth, createAuthErrorResponse } from "@/lib/auth/middleware";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

// 사용자 프로필 수정 스키마
const updateUserProfileSchema = z.object({
  name: z.string().min(1, "이름은 필수입니다").max(255, "이름은 255자 이하여야 합니다").optional(),
  jobRoleIds: z.array(z.string().uuid()).optional(),
  resignationDate: z.string().optional().nullable(),
  desiredWeeklyHours: z.number().int().min(0).max(168).optional().nullable(),
  preferredWeekdays: z
    .array(
      z.object({
        weekday: z.number().int().min(0).max(6),
        isPreferred: z.boolean(),
      })
    )
    .optional(),
});

type UpdateUserProfileRequest = z.infer<typeof updateUserProfileSchema>;

/**
 * 사용자 상세 정보 조회 API
 * GET /api/stores/[id]/users/[userId]
 */
async function getUserDetail(
  request: NextRequest,
  context: { user: any; params: Promise<{ id: string; userId: string }> }
): Promise<NextResponse> {
  try {
    const { user, params } = context;
    const resolvedParams = await params;
    const storeId = resolvedParams.id;
    const userId = resolvedParams.userId;

    const supabase = await createClient();

    // 매장 접근 권한 확인
    const { data: userRole, error: roleError } = await supabase
      .from("user_store_roles")
      .select("role")
      .eq("store_id", storeId)
      .eq("user_id", user.id)
      .eq("status", "ACTIVE")
      .single();

    if (roleError || !userRole) {
      return NextResponse.json(
        {
          success: false,
          error: "매장 접근 권한이 없습니다",
        },
        { status: 403 }
      );
    }

    // 게스트 사용자인지 확인 (store_users.id로 조회)
    const { data: guestUser, error: guestUserError } = await supabase
      .from("store_users")
      .select("*")
      .eq("id", userId)
      .eq("store_id", storeId)
      .eq("is_guest", true)
      .single();

    // 게스트 사용자인 경우
    if (guestUser && !guestUserError) {
      // 게스트 사용자의 직무 역할 조회 (user_store_job_roles에서 store_users.id를 user_id로 사용)
      const { data: jobRoles, error: jobRolesError } = await supabase
        .from("user_store_job_roles")
        .select(
          `
          *,
          store_job_roles (
            id,
            name,
            code,
            description,
            active
          )
        `
        )
        .eq("store_id", storeId)
        .eq("user_id", guestUser.id); // store_users.id를 user_id로 사용

      if (jobRolesError) {
        console.error("게스트 사용자 직무 역할 조회 오류:", jobRolesError);
      }

      // 게스트 사용자 메타데이터에서 추가 정보 조회
      const guestMetadata = (guestUser.metadata as any) || {};
      const resignationDate = guestMetadata.resignation_date || null;
      const desiredWeeklyHours = guestMetadata.desired_weekly_hours || null;

      // 게스트 사용자의 출근이 어려운 요일 조회 (store_users.id를 user_id로 사용)
      const { data: preferredWeekdays, error: weekdaysError } = await supabase
        .from("user_difficult_weekdays")
        .select("weekday, is_preferred")
        .eq("store_id", storeId)
        .eq("user_id", guestUser.id) // store_users.id를 user_id로 사용
        .order("weekday");

      if (weekdaysError) {
        console.error("게스트 사용자 출근이 어려운 요일 조회 오류:", weekdaysError);
      }

      return NextResponse.json({
        success: true,
        data: {
          id: guestUser.id,
          email: null,
          name: guestUser.name,
          role: guestUser.role,
          status: "ACTIVE",
          joinedAt: guestUser.granted_at,
          isDefaultStore: false,
          jobRoles: jobRoles || [],
          resignationDate,
          desiredWeeklyHours,
          preferredWeekdays: preferredWeekdays || [],
          avatarUrl: null,
          isGuest: true,
        },
      });
    }

    // 일반 사용자 조회
    // store_users 테이블에서 userId로 조회 (store_users.id 또는 store_users.user_id로 조회)
    let storeUser = null;
    let authUserId = userId;

    // 먼저 store_users.id로 조회 시도
    const { data: storeUserById, error: storeUserByIdError } = await supabase
      .from("store_users")
      .select("id, user_id, is_guest, is_active, name")
      .eq("id", userId)
      .eq("store_id", storeId)
      .eq("is_guest", false)
      .single();

    if (storeUserById && !storeUserByIdError) {
      storeUser = storeUserById;
      authUserId = storeUser.user_id || userId;
    } else {
      // store_users.id로 찾지 못한 경우, store_users.user_id로 조회 (userId가 auth.users.id일 수 있음)
      const { data: storeUserByUserId, error: storeUserByUserIdError } = await supabase
        .from("store_users")
        .select("id, user_id, is_guest, is_active, name")
        .eq("user_id", userId)
        .eq("store_id", storeId)
        .eq("is_guest", false)
        .eq("is_active", true)
        .single();

      if (storeUserByUserId && !storeUserByUserIdError) {
        storeUser = storeUserByUserId;
        authUserId = storeUser.user_id || userId;
      } else {
        // store_users에 레코드가 없는 경우, userId를 auth.users.id로 사용
        authUserId = userId;
      }
    }
    
    // 사용자 기본 정보 조회
    const { data: userInfo, error: userError } =
      await supabase.auth.admin.getUserById(authUserId);

    if (userError || !userInfo.user) {
      return NextResponse.json(
        {
          success: false,
          error: "사용자를 찾을 수 없습니다",
        },
        { status: 404 }
      );
    }

    // 매장에서의 사용자 역할 조회
    const { data: storeRole, error: storeRoleError } = await supabase
      .from("user_store_roles")
      .select("*")
      .eq("store_id", storeId)
      .eq("user_id", authUserId)
      .single();

    if (storeRoleError) {
      return NextResponse.json(
        {
          success: false,
          error: "사용자 역할 정보를 찾을 수 없습니다",
        },
        { status: 404 }
      );
    }

    // 사용자의 직무 역할 조회
    // storeUser가 있으면 store_users.id를 사용, 없으면 auth.users.id를 사용
    const jobRoleUserId = storeUser?.id || authUserId;
    const { data: jobRoles, error: jobRolesError } = await supabase
      .from("user_store_job_roles")
      .select(
        `
        *,
        store_job_roles (
          id,
          name,
          code,
          description,
          active
        )
      `
      )
      .eq("store_id", storeId)
      .eq("user_id", jobRoleUserId);

    if (jobRolesError) {
      console.error("직무 역할 조회 오류:", jobRolesError);
    }

    // 사용자 프로필 메타데이터에서 추가 정보 조회
    const userMetadata = userInfo.user.user_metadata || {};
    const resignationDate = userMetadata.resignation_date || null;
    const desiredWeeklyHours = userMetadata.desired_weekly_hours || null;

    // 출근이 어려운 요일 조회
    // storeUser가 있으면 store_users.id를 사용, 없으면 auth.users.id를 사용
    const weekdaysUserId = storeUser?.id || authUserId;
    const { data: preferredWeekdays, error: weekdaysError } = await supabase
      .from("user_difficult_weekdays")
      .select("weekday, is_preferred")
      .eq("store_id", storeId)
      .eq("user_id", weekdaysUserId)
      .order("weekday");

    if (weekdaysError) {
      console.error("출근이 어려운 요일 조회 오류:", weekdaysError);
    }

    return NextResponse.json({
      success: true,
      data: {
        id: storeUser?.id || userInfo.user.id, // store_users.id를 우선 사용
        email: userInfo.user.email,
        name:
          storeUser?.name ||
          userInfo.user.user_metadata?.invited_name ||
          userInfo.user.user_metadata?.name ||
          userInfo.user.email?.split("@")[0] ||
          "",
        role: storeRole.role,
        status: storeRole.status,
        joinedAt: storeRole.granted_at,
        isDefaultStore: storeRole.is_default_store,
        jobRoles: jobRoles || [],
        resignationDate,
        desiredWeeklyHours,
        preferredWeekdays: preferredWeekdays || [],
        avatarUrl: userInfo.user.user_metadata?.avatar_url || null,
      },
    });
  } catch (error) {
    console.error("사용자 상세 정보 조회 오류:", error);
    return NextResponse.json(
      {
        success: false,
        error: "사용자 정보 조회에 실패했습니다",
      },
      { status: 500 }
    );
  }
}

/**
 * 사용자 프로필 수정 API
 * PATCH /api/stores/[id]/users/[userId]
 */
async function updateUserProfile(
  request: NextRequest,
  context: { user: any; params: Promise<{ id: string; userId: string }> }
): Promise<NextResponse> {
  try {
    const { user, params } = context;
    const resolvedParams = await params;
    const storeId = resolvedParams.id;
    const userId = resolvedParams.userId;

    const supabase = await createClient();

    // 요청 데이터 검증
    const body = await request.json();
    const validatedData = updateUserProfileSchema.parse(body);

    // 관리자 권한 확인
    const { data: userRole, error: roleError } = await supabase
      .from("user_store_roles")
      .select("role")
      .eq("store_id", storeId)
      .eq("user_id", user.id)
      .eq("status", "ACTIVE")
      .single();

    if (
      roleError ||
      !userRole ||
      !["MASTER", "SUB_MANAGER"].includes(userRole.role)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "관리자 권한이 필요합니다",
        },
        { status: 403 }
      );
    }

    // 게스트 사용자인지 확인 (store_users.id로 조회)
    const { data: guestUser, error: guestUserError } = await supabase
      .from("store_users")
      .select("*")
      .eq("id", userId)
      .eq("store_id", storeId)
      .eq("is_guest", true)
      .single();

    // 게스트 사용자인 경우
    if (guestUser && !guestUserError) {
      // 게스트 사용자 업데이트 데이터 준비
      const updateData: any = {};

      // 이름 업데이트
      if (validatedData.name !== undefined) {
        updateData.name = validatedData.name.trim();
      }

      // 직무 역할 업데이트 (user_store_job_roles는 외래 키 제약이 없으므로 store_users.id를 user_id로 사용)
      if (validatedData.jobRoleIds !== undefined) {
        // 기존 직무 역할 삭제
        const { error: deleteError } = await supabase
          .from("user_store_job_roles")
          .delete()
          .eq("store_id", storeId)
          .eq("user_id", userId); // store_users.id를 user_id로 사용

        if (deleteError) {
          console.error("기존 직무 역할 삭제 오류:", deleteError);
          return NextResponse.json(
            {
              success: false,
              error: "직무 역할 업데이트에 실패했습니다",
            },
            { status: 500 }
          );
        }

        // 새 직무 역할 추가
        if (validatedData.jobRoleIds.length > 0) {
          const roleData = validatedData.jobRoleIds.map((jobRoleId) => ({
            store_id: storeId,
            user_id: userId, // store_users.id를 user_id로 사용
            job_role_id: jobRoleId,
          }));

          const { error: insertError } = await supabase
            .from("user_store_job_roles")
            .insert(roleData);

          if (insertError) {
            console.error("새 직무 역할 추가 오류:", insertError);
            return NextResponse.json(
              {
                success: false,
                error: "직무 역할 업데이트에 실패했습니다",
              },
              { status: 500 }
            );
          }
        }
      }

      // 출근이 어려운 요일 업데이트 (게스트 사용자도 지원)
      if (validatedData.preferredWeekdays !== undefined) {
        // 기존 출근이 어려운 요일 삭제
        const { error: deleteWeekdaysError } = await supabase
          .from("user_difficult_weekdays")
          .delete()
          .eq("store_id", storeId)
          .eq("user_id", userId); // store_users.id를 user_id로 사용

        if (deleteWeekdaysError) {
          console.error("기존 출근이 어려운 요일 삭제 오류:", deleteWeekdaysError);
          return NextResponse.json(
            {
              success: false,
              error: "user.difficultWeekday.deleteError",
            },
            { status: 500 }
          );
        }

        // 새 출근이 어려운 요일 추가
        if (validatedData.preferredWeekdays.length > 0) {
          const weekdaysData = validatedData.preferredWeekdays.map((weekday) => ({
            store_id: storeId,
            user_id: userId, // store_users.id를 user_id로 사용
            weekday: weekday.weekday,
            is_preferred: weekday.isPreferred,
            created_by: user.id, // 관리자 ID
          }));

          const { error: insertWeekdaysError } = await supabase
            .from("user_difficult_weekdays")
            .insert(weekdaysData);

          if (insertWeekdaysError) {
            console.error("새 출근이 어려운 요일 추가 오류:", insertWeekdaysError);
            return NextResponse.json(
              {
                success: false,
                error: "user.difficultWeekday.insertError",
              },
              { status: 500 }
            );
          }
        }
      }

      // 게스트 사용자 메타데이터 업데이트 (퇴사 예정일, 희망 근무 시간)
      const currentMetadata = (guestUser.metadata as any) || {};
      const updatedMetadata: any = { ...currentMetadata };

      if (validatedData.resignationDate !== undefined) {
        updatedMetadata.resignation_date = validatedData.resignationDate;
      }

      if (validatedData.desiredWeeklyHours !== undefined) {
        updatedMetadata.desired_weekly_hours = validatedData.desiredWeeklyHours;
      }

      // 메타데이터가 변경된 경우 store_users 테이블 업데이트
      if (
        validatedData.resignationDate !== undefined ||
        validatedData.desiredWeeklyHours !== undefined
      ) {
        updateData.metadata = updatedMetadata;
      }

      // store_users 테이블 업데이트
      if (Object.keys(updateData).length > 0) {
        const { error: updateStoreUserError } = await supabase
          .from("store_users")
          .update(updateData)
          .eq("id", userId)
          .eq("store_id", storeId);

        if (updateStoreUserError) {
          console.error("게스트 사용자 업데이트 오류:", updateStoreUserError);
          return NextResponse.json(
            {
              success: false,
              error: "게스트 사용자 프로필 업데이트에 실패했습니다",
            },
            { status: 500 }
          );
        }
      }

      return NextResponse.json({
        success: true,
        message: "게스트 사용자 프로필이 성공적으로 업데이트되었습니다",
      });
    }

    // 일반 사용자 조회
    // store_users 테이블에서 userId로 조회 (store_users.id 또는 store_users.user_id로 조회)
    let storeUser = null;
    let authUserId = userId;

    // 먼저 store_users.id로 조회 시도
    const { data: storeUserById, error: storeUserByIdError } = await supabase
      .from("store_users")
      .select("id, user_id, is_guest, is_active, name")
      .eq("id", userId)
      .eq("store_id", storeId)
      .eq("is_guest", false)
      .single();

    if (storeUserById && !storeUserByIdError) {
      storeUser = storeUserById;
      authUserId = storeUser.user_id || userId;
    } else {
      // store_users.id로 찾지 못한 경우, store_users.user_id로 조회 (userId가 auth.users.id일 수 있음)
      const { data: storeUserByUserId, error: storeUserByUserIdError } = await supabase
        .from("store_users")
        .select("id, user_id, is_guest, is_active, name")
        .eq("user_id", userId)
        .eq("store_id", storeId)
        .eq("is_guest", false)
        .eq("is_active", true)
        .single();

      if (storeUserByUserId && !storeUserByUserIdError) {
        storeUser = storeUserByUserId;
        authUserId = storeUser.user_id || userId;
      } else {
        // store_users에 레코드가 없는 경우, userId를 auth.users.id로 사용
        authUserId = userId;
      }
    }

    // 사용자 존재 확인
    const { data: targetUser, error: targetUserError } =
      await supabase.auth.admin.getUserById(authUserId);

    if (targetUserError || !targetUser.user) {
      return NextResponse.json(
        {
          success: false,
          error: "사용자를 찾을 수 없습니다",
        },
        { status: 404 }
      );
    }

    // store_users.id를 사용 (일반 사용자의 경우 store_users.id가 필요)
    const finalStoreUserId = storeUser?.id || userId;

    // 이름 업데이트
    if (validatedData.name !== undefined) {
      const userName = validatedData.name.trim();

      // store_users 테이블의 name 필드 업데이트
      let storeUserNameError = null;
      
      if (storeUser?.id) {
        // store_users.id로 업데이트
        const { error } = await supabase
          .from("store_users")
          .update({ name: userName })
          .eq("id", storeUser.id)
          .eq("store_id", storeId);
        storeUserNameError = error;
      } else if (authUserId) {
        // store_users.id가 없으면 user_id로 업데이트 시도
        const { error } = await supabase
          .from("store_users")
          .update({ name: userName })
          .eq("user_id", authUserId)
          .eq("store_id", storeId)
          .eq("is_active", true);
        storeUserNameError = error;
      }

      if (storeUserNameError) {
        console.error("store_users 이름 업데이트 오류:", storeUserNameError);
        // store_users 업데이트 실패해도 auth.users는 업데이트 시도
      }

      // auth.users의 user_metadata.name 업데이트
      const currentMetadata = targetUser.user.user_metadata || {};
      const { error: authNameError } = await supabase.auth.admin.updateUserById(
        authUserId,
        {
          user_metadata: {
            ...currentMetadata,
            name: userName,
          },
        }
      );

      if (authNameError) {
        console.error("사용자 메타데이터 이름 업데이트 오류:", authNameError);
        // auth.users 업데이트 실패 시 에러 반환
        if (storeUserNameError) {
          return NextResponse.json(
            {
              success: false,
              error: "이름 업데이트에 실패했습니다",
            },
            { status: 500 }
          );
        }
      }
    }

    // 직무 역할 업데이트
    if (validatedData.jobRoleIds !== undefined) {
      // 기존 직무 역할 삭제
      const { error: deleteError } = await supabase
        .from("user_store_job_roles")
        .delete()
        .eq("store_id", storeId)
        .eq("user_id", finalStoreUserId);

      if (deleteError) {
        console.error("기존 직무 역할 삭제 오류:", deleteError);
        return NextResponse.json(
          {
            success: false,
            error: "직무 역할 업데이트에 실패했습니다",
          },
          { status: 500 }
        );
      }

      // 새 직무 역할 추가
      if (validatedData.jobRoleIds.length > 0) {
        const roleData = validatedData.jobRoleIds.map((jobRoleId) => ({
          store_id: storeId,
          user_id: finalStoreUserId,
          job_role_id: jobRoleId,
        }));

        const { error: insertError } = await supabase
          .from("user_store_job_roles")
          .insert(roleData);

        if (insertError) {
          console.error("새 직무 역할 추가 오류:", insertError);
          return NextResponse.json(
            {
              success: false,
              error: "직무 역할 업데이트에 실패했습니다",
            },
            { status: 500 }
          );
        }
      }
    }

    // 출근이 어려운 요일 업데이트
    if (validatedData.preferredWeekdays !== undefined) {
      // 기존 출근이 어려운 요일 삭제
      const { error: deleteWeekdaysError } = await supabase
        .from("user_difficult_weekdays")
        .delete()
        .eq("store_id", storeId)
        .eq("user_id", finalStoreUserId);

      if (deleteWeekdaysError) {
        console.error("기존 출근이 어려운 요일 삭제 오류:", deleteWeekdaysError);
        return NextResponse.json(
          {
            success: false,
            error: "difficultWeekday.deleteError",
          },
          { status: 500 }
        );
      }

      // 새 출근이 어려운 요일 추가
      if (validatedData.preferredWeekdays.length > 0) {
        const weekdaysData = validatedData.preferredWeekdays.map((weekday) => ({
          store_id: storeId,
          user_id: finalStoreUserId,
          weekday: weekday.weekday,
          is_preferred: weekday.isPreferred,
          created_by: user.id,
        }));

        const { error: insertWeekdaysError } = await supabase
          .from("user_difficult_weekdays")
          .insert(weekdaysData);

        if (insertWeekdaysError) {
          console.error("새 출근이 어려운 요일 추가 오류:", insertWeekdaysError);
          return NextResponse.json(
            {
              success: false,
              error: "user.difficultWeekday.insertError",
            },
            { status: 500 }
          );
        }
      }
    }

    // 사용자 메타데이터 업데이트 (퇴사 예정일, 희망 근무 시간)
    const currentMetadata = targetUser.user.user_metadata || {};
    const updatedMetadata = {
      ...currentMetadata,
      ...(validatedData.resignationDate !== undefined && {
        resignation_date: validatedData.resignationDate,
      }),
      ...(validatedData.desiredWeeklyHours !== undefined && {
        desired_weekly_hours: validatedData.desiredWeeklyHours,
      }),
    };

    const { error: updateError } = await supabase.auth.admin.updateUserById(
      userId,
      {
        user_metadata: updatedMetadata,
      }
    );

    if (updateError) {
      console.error("사용자 메타데이터 업데이트 오류:", updateError);
      return NextResponse.json(
        {
          success: false,
          error: "프로필 업데이트에 실패했습니다",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "프로필이 성공적으로 업데이트되었습니다",
    });
  } catch (error) {
    console.error("사용자 프로필 수정 오류:", error);
    return NextResponse.json(
      {
        success: false,
        error: "프로필 수정에 실패했습니다",
      },
      { status: 500 }
    );
  }
}

// 인증 필요 - Next.js App Router에서 params는 자동으로 전달됨
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; userId: string }> }
) {
  const authResult = await checkAuth(request);
  if (!authResult.success) {
    return createAuthErrorResponse(authResult);
  }
  if (!authResult.user) {
    return createAuthErrorResponse({
      success: false,
      error: "User profile not found",
      statusCode: 401,
    });
  }
  return getUserDetail(request, {
    user: authResult.user,
    params: context.params,
  });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; userId: string }> }
) {
  const authResult = await checkAuth(request);
  if (!authResult.success) {
    return createAuthErrorResponse(authResult);
  }
  if (!authResult.user) {
    return createAuthErrorResponse({
      success: false,
      error: "User profile not found",
      statusCode: 401,
    });
  }
  return updateUserProfile(request, {
    user: authResult.user,
    params: context.params,
  });
}
