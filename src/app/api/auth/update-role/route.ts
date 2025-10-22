import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { UserRole } from "@/types/auth";

/**
 * 사용자 역할 업데이트 API (현재 사용자의 역할만 업데이트)
 * POST /api/auth/update-role
 */
async function updateUserRole(request: NextRequest, context: { user: any }) {
  try {
    const { role } = await request.json();

    // 역할 유효성 검사
    if (!Object.values(UserRole).includes(role)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid role specified",
        },
        { status: 400 }
      );
    }

    // 현재 사용자 정보
    const { user } = context;

    // Supabase Auth 사용자 메타데이터 업데이트
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const { data, error } = await supabase.auth.updateUser({
      data: {
        role: role,
        name: user.name, // 기존 이름 유지
      },
    });

    if (error) {
      console.error("역할 업데이트 오류:", error);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to update user role",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "User role updated successfully",
      data: {
        userId: user.id,
        newRole: role,
        previousRole: user.role,
      },
    });
  } catch (error) {
    console.error("Update role API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}

// 인증 필요
export const POST = withAuth(updateUserRole);



















