"use client";

import React, { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useParams } from "next/navigation";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { defaultLocale } from "@/lib/i18n-config";
import { t, type Locale } from "@/lib/i18n";
import { UserPlus, Mail, Shield } from "lucide-react";

/**
 * 초대 폼 스키마
 */
const inviteFormSchemaBase = z.object({
  email: z.string().email(),
  role: z.enum(["SUB_MANAGER", "PART_TIMER"]),
  store_id: z.string().min(1),
});

function createInviteFormSchema(locale: Locale) {
  return z.object({
    email: z.string().email(t("auth.login.validation.invalidEmail", locale)),
    role: z.enum(["SUB_MANAGER", "PART_TIMER"], {
      errorMap: () => ({ message: t("invite.rolePlaceholder", locale) }),
    }),
    store_id: z.string().min(1, t("invites.form.storeRequired", locale)),
  });
}

type InviteFormData = z.infer<typeof inviteFormSchemaBase>;

interface InviteUserFormProps {
  stores: Array<{
    id: string;
    name: string;
    description?: string;
  }>;
  onSuccess?: (invite: any) => void;
  className?: string;
}

/**
 * 파트타이머 초대 폼 컴포넌트
 */
export function InviteUserForm({
  stores,
  onSuccess,
  className,
}: InviteUserFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const params = useParams();
  const locale = (params?.locale as Locale) || defaultLocale;
  const inviteFormSchema = useMemo(() => createInviteFormSchema(locale), [locale]);

  const form = useForm<InviteFormData>({
    resolver: zodResolver(inviteFormSchema),
    defaultValues: {
      email: "",
      role: "PART_TIMER",
      store_id: "",
    },
  });

  /**
   * 초대 생성 처리
   */
  const handleSubmit = async (data: InviteFormData) => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/invites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || t("invite.createError", locale));
      }

      // 성공 처리
      toast({
        title: t("invite.createSuccess", locale),
        description: t("invites.form.invitedDescription", locale, {
          email: data.email,
        }),
      });

      // 폼 초기화
      form.reset();

      // 부모 컴포넌트에 성공 콜백 호출
      onSuccess?.(result.data);
    } catch (error) {
      console.error("초대 생성 오류:", error);
      toast({
        title: t("invite.createError", locale),
        description:
          error instanceof Error
            ? error.message
            : t("common.unknownError", locale),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 역할별 설명 텍스트
   */
  const getRoleDescription = (role: string) => {
    switch (role) {
      case "SUB_MANAGER":
        return t("invite.roleDescription.subManager", locale);
      case "PART_TIMER":
        return t("invite.roleDescription.partTimer", locale);
      default:
        return "";
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          {t("invites.form.title", locale)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-6"
          >
            {/* 매장 선택 */}
            <FormField
              control={form.control}
              name="store_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("invites.form.store", locale)}</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isLoading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("invite.storePlaceholder", locale)} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {stores.map((store) => (
                        <SelectItem key={store.id} value={store.id}>
                          <div className="flex flex-col">
                            <span className="font-medium">{store.name}</span>
                            {store.description && (
                              <span className="text-sm text-muted-foreground">
                                {store.description}
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 이메일 입력 */}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    {t("invites.form.email", locale)}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder={t("invite.emailPlaceholder", locale)}
                      disabled={isLoading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 역할 선택 */}
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    {t("invites.form.role", locale)}
                  </FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isLoading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("invite.rolePlaceholder", locale)} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="PART_TIMER">
                        <div className="flex flex-col">
                          <span className="font-medium">{t("invite.partTimer", locale)}</span>
                          <span className="text-sm text-muted-foreground">
                            {getRoleDescription("PART_TIMER")}
                          </span>
                        </div>
                      </SelectItem>
                      <SelectItem value="SUB_MANAGER">
                        <div className="flex flex-col">
                          <span className="font-medium">{t("invite.subManager", locale)}</span>
                          <span className="text-sm text-muted-foreground">
                            {getRoleDescription("SUB_MANAGER")}
                          </span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 제출 버튼 */}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  {t("invites.form.sending", locale)}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  {t("invites.form.send", locale)}
                </div>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}



