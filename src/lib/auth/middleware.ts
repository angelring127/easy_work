import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { UserRole, Permission, type UserProfile } from "@/types/auth";
import { hasPermission, checkUserPermission } from "@/lib/auth/permissions";

/**
 * API 라우트 권한 확인 결과
 */
export interface AuthCheckResult {
  success: boolean;
  user?: UserProfile;
  error?: string;
  statusCode?: number;
}

/**
 * 권한 확인 옵션
 */
export interface AuthMiddlewareOptions {
  requiredPermissions?: Permission[];
  requiredRole?: UserRole;
  allowUnauthenticated?: boolean;
}

/**
 * API 라우트에서 사용자 인증 및 권한을 확인하는 미들웨어
 * @param request Next.js 요청 객체
 * @param options 권한 확인 옵션
 * @returns 인증 확인 결과
 */
export async function checkAuth(
  request: NextRequest,
  options: AuthMiddlewareOptions = {}
): Promise<AuthCheckResult> {
  try {
    const supabase = await createClient();

    // 사용자 인증 확인
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      return {
        success: false,
        error: "Failed to verify user",
        statusCode: 401,
      };
    }

    // 인증되지 않은 사용자 처리
    if (!user) {
      if (options.allowUnauthenticated) {
        return { success: true };
      }

      return {
        success: false,
        error: "Authentication required",
        statusCode: 401,
      };
    }

    // 사용자 프로필 생성
    const userProfile: UserProfile = {
      id: user.id,
      email: user.email || "",
      name: user.user_metadata?.name || user.email?.split("@")[0] || "",
      role: (user.user_metadata?.role as UserRole) || UserRole.PART_TIMER,
      created_at: user.created_at,
      updated_at: user.updated_at || user.created_at,
    };

    // 특정 역할 확인
    if (options.requiredRole && userProfile.role !== options.requiredRole) {
      return {
        success: false,
        error: `Required role: ${options.requiredRole}`,
        statusCode: 403,
      };
    }

    // 권한 확인
    if (options.requiredPermissions && options.requiredPermissions.length > 0) {
      for (const permission of options.requiredPermissions) {
        const permissionCheck = checkUserPermission(userProfile, permission);
        if (!permissionCheck.hasPermission) {
          return {
            success: false,
            error:
              permissionCheck.reason || `Permission required: ${permission}`,
            statusCode: 403,
          };
        }
      }
    }

    return {
      success: true,
      user: userProfile,
    };
  } catch (error) {
    console.error("Auth middleware error:", error);
    return {
      success: false,
      error: "Internal authentication error",
      statusCode: 500,
    };
  }
}

/**
 * 관리자 권한 확인 미들웨어 (MASTER 또는 SUB_MANAGER)
 */
export async function requireAdmin(
  request: NextRequest
): Promise<AuthCheckResult> {
  const result = await checkAuth(request, {
    requiredPermissions: [Permission.VIEW_ADMIN_DASHBOARD],
  });

  if (!result.success) {
    return result;
  }

  // 관리자 역할 확인
  if (
    result.user &&
    (result.user.role === UserRole.MASTER ||
      result.user.role === UserRole.SUB_MANAGER)
  ) {
    return result;
  }

  return {
    success: false,
    error: "Admin privileges required",
    statusCode: 403,
  };
}

/**
 * 마스터 권한 확인 미들웨어
 */
export async function requireMaster(
  request: NextRequest
): Promise<AuthCheckResult> {
  return checkAuth(request, {
    requiredRole: UserRole.MASTER,
  });
}

/**
 * 권한 확인 결과에 따른 에러 응답 생성
 */
export function createAuthErrorResponse(result: AuthCheckResult): NextResponse {
  return NextResponse.json(
    {
      error: result.error || "Authentication failed",
      code: result.statusCode || 401,
    },
    { status: result.statusCode || 401 }
  );
}

/**
 * API 라우트 핸들러를 권한 확인으로 감싸는 HOF (Higher-Order Function)
 */
export function withAuth(
  handler: (
    request: NextRequest,
    context: { user: UserProfile }
  ) => Promise<NextResponse>,
  options: AuthMiddlewareOptions = {}
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const authResult = await checkAuth(request, options);

    if (!authResult.success) {
      return createAuthErrorResponse(authResult);
    }

    if (!authResult.user && !options.allowUnauthenticated) {
      return createAuthErrorResponse({
        success: false,
        error: "User profile not found",
        statusCode: 401,
      });
    }

    // 인증된 사용자와 함께 핸들러 실행
    return handler(request, { user: authResult.user! });
  };
}

/**
 * 관리자 권한이 필요한 API 라우트 핸들러를 감싸는 HOF
 */
export function withAdminAuth(
  handler: (
    request: NextRequest,
    context: { user: UserProfile }
  ) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const authResult = await requireAdmin(request);

    if (!authResult.success) {
      return createAuthErrorResponse(authResult);
    }

    return handler(request, { user: authResult.user! });
  };
}

/**
 * 마스터 권한이 필요한 API 라우트 핸들러를 감싸는 HOF
 */
export function withMasterAuth(
  handler: (
    request: NextRequest,
    context: { user: UserProfile }
  ) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const authResult = await requireMaster(request);

    if (!authResult.success) {
      return createAuthErrorResponse(authResult);
    }

    return handler(request, { user: authResult.user! });
  };
}
