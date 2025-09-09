import { NextRequest, NextResponse } from "next/server";
import { checkAuth, createAuthErrorResponse } from "@/lib/auth/middleware";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

// 패스워드 변경 스키마
const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "현재 비밀번호를 입력해주세요"),
    newPassword: z.string().min(6, "비밀번호는 최소 6자 이상이어야 합니다"),
    confirmPassword: z.string().min(1, "비밀번호 확인을 입력해주세요"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "비밀번호가 일치하지 않습니다",
    path: ["confirmPassword"],
  });

type ChangePasswordRequest = z.infer<typeof changePasswordSchema>;

/**
 * 패스워드 변경 API
 * POST /api/auth/change-password
 */
async function changePassword(
  request: NextRequest,
  context: { user: any }
): Promise<NextResponse> {
  try {
    const { user } = context;

    // 요청 데이터 검증
    const body = await request.json();
    const validatedData = changePasswordSchema.parse(body);

    const supabase = await createClient();

    // 현재 비밀번호 확인
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: validatedData.currentPassword,
    });

    if (signInError) {
      return NextResponse.json(
        {
          success: false,
          error: "현재 비밀번호가 올바르지 않습니다",
        },
        { status: 400 }
      );
    }

    // 새 비밀번호로 업데이트
    const { error: updateError } = await supabase.auth.updateUser({
      password: validatedData.newPassword,
    });

    if (updateError) {
      console.error("비밀번호 변경 오류:", updateError);
      return NextResponse.json(
        {
          success: false,
          error: "비밀번호 변경에 실패했습니다",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "비밀번호가 성공적으로 변경되었습니다",
    });
  } catch (error) {
    console.error("비밀번호 변경 API 오류:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: error.errors[0].message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "비밀번호 변경에 실패했습니다",
      },
      { status: 500 }
    );
  }
}

// 인증 필요
export async function POST(request: NextRequest) {
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
  return changePassword(request, { user: authResult.user });
}
