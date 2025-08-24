import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { UserRole } from "@/types/auth";

/**
 * 현재 사용자를 마스터로 승격 (개발/테스트용)
 * POST /api/auth/promote-to-master
 */
async function promoteToMaster(request: NextRequest, context: { user: any }) {
  try {
    const { user } = context;

    // 이미 마스터인 경우
    if (user.role === UserRole.MASTER) {
      return NextResponse.json({
        success: true,
        message: "User is already a master",
        data: {
          userId: user.id,
          currentRole: user.role,
        },
      });
    }

    // Supabase Auth 사용자 메타데이터 업데이트
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const { data, error } = await supabase.auth.updateUser({
      data: {
        role: UserRole.MASTER,
        name: user.name, // 기존 이름 유지
      },
    });

    if (error) {
      console.error("마스터 승격 오류:", error);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to promote user to master",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "User promoted to master successfully",
      data: {
        userId: user.id,
        email: user.email,
        previousRole: user.role,
        newRole: UserRole.MASTER,
      },
    });
  } catch (error) {
    console.error("Promote to master API error:", error);
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
export const POST = withAuth(promoteToMaster);

