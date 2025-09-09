import { NextRequest, NextResponse } from "next/server";
import { checkAuth, createAuthErrorResponse } from "@/lib/auth/middleware";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

// 사용자 프로필 수정 스키마
const updateUserProfileSchema = z.object({
  jobRoleIds: z.array(z.string().uuid()).optional(),
  resignationDate: z.string().optional().nullable(),
  desiredWeeklyHours: z.number().int().min(0).max(168).optional().nullable(),
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

    // 사용자 기본 정보 조회
    const { data: userInfo, error: userError } =
      await supabase.auth.admin.getUserById(userId);

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
      .eq("user_id", userId)
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
      .eq("user_id", userId);

    if (jobRolesError) {
      console.error("직무 역할 조회 오류:", jobRolesError);
    }

    // 사용자 프로필 메타데이터에서 추가 정보 조회
    const userMetadata = userInfo.user.user_metadata || {};
    const resignationDate = userMetadata.resignation_date || null;
    const desiredWeeklyHours = userMetadata.desired_weekly_hours || null;

    return NextResponse.json({
      success: true,
      data: {
        id: userInfo.user.id,
        email: userInfo.user.email,
        name:
          userInfo.user.user_metadata?.name ||
          userInfo.user.email?.split("@")[0],
        role: storeRole.role,
        status: storeRole.status,
        joinedAt: storeRole.granted_at,
        isDefaultStore: storeRole.is_default_store,
        jobRoles: jobRoles || [],
        resignationDate,
        desiredWeeklyHours,
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

    // 사용자 존재 확인
    const { data: targetUser, error: targetUserError } =
      await supabase.auth.admin.getUserById(userId);

    if (targetUserError || !targetUser.user) {
      return NextResponse.json(
        {
          success: false,
          error: "사용자를 찾을 수 없습니다",
        },
        { status: 404 }
      );
    }

    // 직무 역할 업데이트
    if (validatedData.jobRoleIds !== undefined) {
      // 기존 직무 역할 삭제
      const { error: deleteError } = await supabase
        .from("user_store_job_roles")
        .delete()
        .eq("store_id", storeId)
        .eq("user_id", userId);

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
          user_id: userId,
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
