import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";

/**
 * 사용자 프로필 조회 API
 * GET /api/auth/profile
 */
async function getProfile(request: NextRequest, context: { user: any }) {
  try {
    const { user } = context;

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
    });
  } catch (error) {
    console.error("Profile API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch profile",
      },
      { status: 500 }
    );
  }
}

// 권한 확인 미들웨어로 래핑
export const GET = withAuth(getProfile);

