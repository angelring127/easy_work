import { z } from "zod";
import { defaultLocale, isValidLocale, t, type Locale } from "@/lib/i18n";

// 회원가입 폼 스키마
export const signUpSchema = z
  .object({
    email: z
      .string()
      .min(1, "이메일을 입력하세요")
      .email("유효한 이메일 주소를 입력하세요"),
    password: z
      .string()
      .min(8, "비밀번호는 최소 8자 이상이어야 합니다")
      .regex(/[A-Za-z]/, "비밀번호는 최소 1개의 영문자를 포함해야 합니다")
      .regex(/[0-9]/, "비밀번호는 최소 1개의 숫자를 포함해야 합니다"),
    confirmPassword: z.string().min(1, "비밀번호 확인을 입력하세요"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "비밀번호가 일치하지 않습니다",
    path: ["confirmPassword"],
  });

const signInSchemaBase = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

// 로그인 폼 스키마
export function createSignInSchema(locale: Locale = defaultLocale) {
  const safeLocale: Locale = isValidLocale(locale) ? locale : defaultLocale;

  return z.object({
    email: z
      .string()
      .min(1, t("auth.login.validation.emailRequired", safeLocale))
      .email(t("auth.login.validation.invalidEmail", safeLocale)),
    password: z
      .string()
      .min(1, t("auth.login.validation.passwordRequired", safeLocale)),
  });
}

// 타입 정의
export type SignUpFormData = z.infer<typeof signUpSchema>;
export type SignInFormData = z.infer<typeof signInSchemaBase>;

// API 응답 타입
export interface AuthApiResponse {
  success: boolean;
  message?: string;
  error?: string;
  data?: {
    user?: {
      id: string;
      email: string;
    };
    needsEmailConfirmation?: boolean;
  };
  details?: any;
}
