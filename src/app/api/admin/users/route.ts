import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/auth/middleware";

/**
 * 사용자 목록 조회 API (관리자 전용)
 * GET /api/admin/users
 */
async function getUsers(request: NextRequest, context: { user: any }) {
  try {
    const { user } = context;

    // 실제로는 데이터베이스에서 사용자 목록을 가져오겠지만,
    // 현재는 테스트용으로 현재 사용자 정보만 반환
    return NextResponse.json({
      success: true,
      data: {
        users: [
          {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            created_at: user.created_at,
          },
        ],
        total: 1,
        requestedBy: {
          id: user.id,
          role: user.role,
        },
      },
    });
  } catch (error) {
    console.error("Admin users API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch users",
      },
      { status: 500 }
    );
  }
}

// 관리자 권한 확인 미들웨어로 래핑
export const GET = withAdminAuth(getUsers);

