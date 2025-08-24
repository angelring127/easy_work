import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// 로그인 요청 스키마
const signInSchema = z.object({
  email: z.string().email("유효한 이메일 주소를 입력하세요"),
  password: z.string().min(1, "비밀번호를 입력하세요"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 입력 데이터 검증
    const validationResult = signInSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "입력 데이터가 유효하지 않습니다",
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { email, password } = validationResult.data;

    // Supabase Auth로 로그인 처리
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error("로그인 처리 중 오류:", error);

      // Supabase 에러 코드에 따른 사용자 친화적 메시지
      let errorMessage = "로그인 중 오류가 발생했습니다";

      if (
        error.message.includes("Invalid login credentials") ||
        error.message.includes("invalid_credentials")
      ) {
        errorMessage = "이메일 또는 비밀번호가 올바르지 않습니다";
      } else if (error.message.includes("Email not confirmed")) {
        errorMessage =
          "이메일 확인이 필요합니다. 가입 시 받은 이메일을 확인해주세요";
      } else if (error.message.includes("Too many requests")) {
        errorMessage = "너무 많은 로그인 시도입니다. 잠시 후 다시 시도해주세요";
      } else if (error.message.includes("User not found")) {
        errorMessage = "등록되지 않은 이메일 주소입니다";
      }

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          code: error.message,
        },
        { status: 401 }
      );
    }

    // 로그인 성공
    return NextResponse.json({
      success: true,
      message: "로그인이 완료되었습니다",
      data: {
        user: {
          id: data.user?.id,
          email: data.user?.email,
          emailConfirmed: data.user?.email_confirmed_at != null,
        },
        session: {
          accessToken: data.session?.access_token,
          refreshToken: data.session?.refresh_token,
          expiresAt: data.session?.expires_at,
        },
      },
    });
  } catch (error) {
    console.error("로그인 API 오류:", error);
    return NextResponse.json(
      {
        success: false,
        error: "서버 오류가 발생했습니다",
      },
      { status: 500 }
    );
  }
}
