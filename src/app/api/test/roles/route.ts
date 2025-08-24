import { NextRequest, NextResponse } from "next/server";
import { withAuth, withAdminAuth, withMasterAuth } from "@/lib/auth/middleware";

/**
 * 기본 인증 테스트 API
 * GET /api/test/roles?type=basic
 */
async function testBasicAuth(request: NextRequest, context: { user: any }) {
  return NextResponse.json({
    success: true,
    message: "Basic authentication successful",
    data: {
      userId: context.user.id,
      email: context.user.email,
      role: context.user.role,
      testType: "basic",
    },
  });
}

/**
 * 관리자 권한 테스트 API
 * GET /api/test/roles?type=admin
 */
async function testAdminAuth(request: NextRequest, context: { user: any }) {
  return NextResponse.json({
    success: true,
    message: "Admin authentication successful",
    data: {
      userId: context.user.id,
      email: context.user.email,
      role: context.user.role,
      testType: "admin",
      hasAdminAccess: true,
    },
  });
}

/**
 * 마스터 권한 테스트 API
 * GET /api/test/roles?type=master
 */
async function testMasterAuth(request: NextRequest, context: { user: any }) {
  return NextResponse.json({
    success: true,
    message: "Master authentication successful",
    data: {
      userId: context.user.id,
      email: context.user.email,
      role: context.user.role,
      testType: "master",
      hasMasterAccess: true,
    },
  });
}

/**
 * 역할별 권한 테스트 라우터
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const testType = searchParams.get("type") || "basic";

  try {
    switch (testType) {
      case "basic":
        return await withAuth(testBasicAuth)(request);

      case "admin":
        return await withAdminAuth(testAdminAuth)(request);

      case "master":
        return await withMasterAuth(testMasterAuth)(request);

      default:
        return NextResponse.json(
          {
            success: false,
            error: "Invalid test type. Use: basic, admin, or master",
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Role test API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}

