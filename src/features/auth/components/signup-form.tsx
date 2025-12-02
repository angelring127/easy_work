"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

import {
  signUpSchema,
  type SignUpFormData,
  type AuthApiResponse,
} from "@/lib/validations/auth";
import { t, type Locale } from "@/lib/i18n";
import { defaultLocale } from "@/lib/i18n-config";

interface SignUpFormProps {
  onSuccess?: (data: AuthApiResponse) => void;
  onError?: (error: string) => void;
}

// 회원가입 API 호출 함수
async function signUpUser(
  data: SignUpFormData,
  locale: string
): Promise<AuthApiResponse> {
  const response = await fetch("/api/auth/signup", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...data,
      locale, // locale을 body에 포함
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.error || t("auth.signup.errorDescription", locale as any)
    );
  }

  return result;
}

export function SignUpForm({ onSuccess, onError }: SignUpFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { toast } = useToast();
  const params = useParams();
  const locale = (params?.locale as Locale) || defaultLocale;

  const form = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const signUpMutation = useMutation({
    mutationFn: (data: SignUpFormData) => signUpUser(data, locale),
    onSuccess: (data) => {
      toast({
        title: t("auth.signup.success", locale),
        description:
          data.message || t("auth.signup.successDescription", locale),
      });
      onSuccess?.(data);
    },
    onError: (error: Error) => {
      const errorMessage =
        error.message || t("auth.signup.errorDescription", locale);
      toast({
        title: t("auth.signup.error", locale),
        description: errorMessage,
        variant: "destructive",
      });
      onError?.(errorMessage);
    },
  });

  const onSubmit = (data: SignUpFormData) => {
    signUpMutation.mutate(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* 이메일 필드 */}
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("auth.signup.email", locale)}</FormLabel>
              <FormControl>
                <Input
                  placeholder={t("auth.signup.emailPlaceholder", locale)}
                  type="email"
                  autoComplete="email"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* 비밀번호 필드 */}
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("auth.signup.password", locale)}</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    placeholder={t("auth.signup.passwordPlaceholder", locale)}
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    {...field}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={
                      showPassword
                        ? t("auth.signup.passwordHide", locale)
                        : t("auth.signup.passwordShow", locale)
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* 비밀번호 확인 필드 */}
        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("auth.signup.confirmPassword", locale)}</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    placeholder={t(
                      "auth.signup.confirmPasswordPlaceholder",
                      locale
                    )}
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    {...field}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={
                      showConfirmPassword
                        ? t("auth.signup.passwordHide", locale)
                        : t("auth.signup.passwordShow", locale)
                    }
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* 제출 버튼 */}
        <Button
          type="submit"
          className="w-full"
          disabled={signUpMutation.isPending}
        >
          {signUpMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("auth.signup.submitting", locale)}
            </>
          ) : (
            t("auth.signup.submit", locale)
          )}
        </Button>
      </form>
    </Form>
  );
}
