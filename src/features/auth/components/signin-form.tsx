"use client";

import { useMemo, useState } from "react";
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
import { useAuth } from "@/contexts/auth-context";
import { t, type Locale } from "@/lib/i18n";
import { defaultLocale } from "@/lib/i18n-config";
import { cn } from "@/lib/utils";

import {
  createSignInSchema,
  type SignInFormData,
  type AuthApiResponse,
} from "@/lib/validations/auth";

interface SignInFormProps {
  onSuccess?: (
    data: AuthApiResponse
  ) => boolean | void | Promise<boolean | void>;
  onError?: (error: string) => void;
  formClassName?: string;
  labelClassName?: string;
  inputClassName?: string;
  messageClassName?: string;
  submitButtonClassName?: string;
  passwordToggleClassName?: string;
}

// 로그인 API 호출 함수
async function signInUser(
  data: SignInFormData,
  locale: string
): Promise<AuthApiResponse> {
  const response = await fetch("/api/auth/signin", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...data,
      locale,
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.error || t("auth.login.errorDescription", locale as any)
    );
  }

  return result;
}

export function SignInForm({
  onSuccess,
  onError,
  formClassName,
  labelClassName,
  inputClassName,
  messageClassName,
  submitButtonClassName,
  passwordToggleClassName,
}: SignInFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const { refreshSession } = useAuth();
  const params = useParams();
  const locale = (params?.locale as Locale) || defaultLocale;
  const signInSchema = useMemo(() => createSignInSchema(locale), [locale]);

  const form = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const signInMutation = useMutation({
    mutationFn: (data: SignInFormData) => signInUser(data, locale),
    onSuccess: async (data) => {
      // AuthContext 상태 새로고침
      await refreshSession();

      const shouldContinue = (await onSuccess?.(data)) ?? true;
      if (!shouldContinue) {
        return;
      }

      toast({
        title: t("auth.login.success", locale),
        description: data.message || t("auth.login.successDescription", locale),
      });
    },
    onError: (error: Error) => {
      const errorMessage =
        error.message || t("auth.login.errorDescription", locale);
      toast({
        title: t("auth.login.error", locale),
        description: errorMessage,
        variant: "destructive",
      });
      onError?.(errorMessage);
    },
  });

  const onSubmit = (data: SignInFormData) => {
    signInMutation.mutate(data);
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn("space-y-6", formClassName)}
      >
        {/* 이메일 필드 */}
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={labelClassName}>
                {t("auth.login.email", locale)}
              </FormLabel>
              <FormControl>
                <Input
                  placeholder={t("auth.login.emailPlaceholder", locale)}
                  type="email"
                  autoComplete="email"
                  className={inputClassName}
                  {...field}
                />
              </FormControl>
              <FormMessage className={messageClassName} />
            </FormItem>
          )}
        />

        {/* 비밀번호 필드 */}
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={labelClassName}>
                {t("auth.login.password", locale)}
              </FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    placeholder={t("auth.login.passwordPlaceholder", locale)}
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    className={inputClassName}
                    {...field}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent",
                      passwordToggleClassName
                    )}
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={
                      showPassword
                        ? t("auth.login.passwordHide", locale)
                        : t("auth.login.passwordShow", locale)
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
              <FormMessage className={messageClassName} />
            </FormItem>
          )}
        />

        {/* 제출 버튼 */}
        <Button
          type="submit"
          className={cn("w-full", submitButtonClassName)}
          disabled={signInMutation.isPending}
        >
          {signInMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("auth.login.submitting", locale)}
            </>
          ) : (
            t("auth.login.submit", locale)
          )}
        </Button>
      </form>
    </Form>
  );
}
