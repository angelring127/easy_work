import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { UserRole } from "@/types/auth";
import { getEmailVerificationRedirectUrl } from "@/lib/env";

// 회원가입 요청 스키마
const signUpSchema = z
  .object({
    email: z.string().email("유효한 이메일 주소를 입력하세요"),
    password: z.string().min(8, "비밀번호는 최소 8자 이상이어야 합니다"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "비밀번호가 일치하지 않습니다",
    path: ["confirmPassword"],
  });

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 입력 데이터 검증
    const validationResult = signUpSchema.safeParse(body);
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

    // Supabase Auth로 회원가입 처리
    const supabase = await createClient();

    // 기본적으로 모든 사용자는 PART_TIMER로 가입
    // 마스터가 되려면 별도의 승격 과정이 필요
    const userRole = UserRole.PART_TIMER;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // 사용자 메타데이터에 역할 정보 저장
        data: {
          role: userRole,
          name: email.split("@")[0], // 이메일의 @ 앞부분을 기본 이름으로 사용
        },
        // 이메일 확인 후 리다이렉트할 URL (선택사항)
        // emailRedirectTo: getEmailVerificationRedirectUrl(),
        emailRedirectTo:
          "https://easy-work-ten.vercel.app/ko/auth/verify-email",
      },
    });

    console.log("회원가입 결과:", data);

    if (error) {
      console.error("회원가입 처리 중 오류:", error);

      // Supabase 에러 코드에 따른 사용자 친화적 메시지
      let errorMessage = "회원가입 중 오류가 발생했습니다";

      if (
        error.message.includes("already registered") ||
        error.message.includes("User already registered")
      ) {
        errorMessage = "이미 등록된 이메일 주소입니다";
      } else if (error.message.includes("password")) {
        errorMessage = "비밀번호 조건을 확인해주세요";
      } else if (
        error.message.includes("invalid") &&
        error.message.includes("email")
      ) {
        errorMessage =
          "유효하지 않은 이메일 주소입니다. 실제 이메일 주소를 사용해주세요";
      } else if (error.message.includes("email")) {
        errorMessage = "이메일 주소를 확인해주세요";
      } else if (error.message.includes("Signup is disabled")) {
        errorMessage = "현재 회원가입이 비활성화되어 있습니다";
      }

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          code: error.message,
        },
        { status: 400 }
      );
    }

    // 회원가입 성공
    return NextResponse.json({
      success: true,
      message: "회원가입이 완료되었습니다",
      data: {
        user: {
          id: data.user?.id,
          email: data.user?.email,
          role: userRole,
        },
        needsEmailConfirmation: !data.session, // 세션이 없으면 이메일 확인 필요
      },
    });
  } catch (error) {
    console.error("회원가입 API 오류:", error);
    return NextResponse.json(
      {
        success: false,
        error: "서버 오류가 발생했습니다",
      },
      { status: 500 }
    );
  }
}
