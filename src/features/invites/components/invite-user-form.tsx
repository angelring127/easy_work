"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { t } from "@/lib/i18n";
import { UserPlus, Mail, Shield } from "lucide-react";

/**
 * 초대 폼 스키마
 */
const inviteFormSchema = z.object({
  email: z.string().email("유효한 이메일 주소를 입력해주세요"),
  role: z.enum(["SUB_MANAGER", "PART_TIMER"], {
    errorMap: () => ({ message: "역할을 선택해주세요" }),
  }),
  store_id: z.string().min(1, "매장을 선택해주세요"),
});

type InviteFormData = z.infer<typeof inviteFormSchema>;

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
        throw new Error(result.error || "초대 생성에 실패했습니다");
      }

      // 성공 처리
      toast({
        title: "초대 생성 완료",
        description: `${data.email}에게 초대가 발송되었습니다`,
      });

      // 폼 초기화
      form.reset();

      // 부모 컴포넌트에 성공 콜백 호출
      onSuccess?.(result.data);
    } catch (error) {
      console.error("초대 생성 오류:", error);
      toast({
        title: "초대 생성 실패",
        description:
          error instanceof Error
            ? error.message
            : "알 수 없는 오류가 발생했습니다",
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
        return "스케줄 관리, 교대 승인, 파트타이머 초대 권한";
      case "PART_TIMER":
        return "스케줄 확인, 교대 요청 권한";
      default:
        return "";
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          {t("invites.form.title")}
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
                  <FormLabel>{t("invites.form.store")}</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isLoading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="매장을 선택하세요" />
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
                    {t("invites.form.email")}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="초대할 사용자의 이메일 주소"
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
                    {t("invites.form.role")}
                  </FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isLoading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="역할을 선택하세요" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="PART_TIMER">
                        <div className="flex flex-col">
                          <span className="font-medium">파트타이머</span>
                          <span className="text-sm text-muted-foreground">
                            {getRoleDescription("PART_TIMER")}
                          </span>
                        </div>
                      </SelectItem>
                      <SelectItem value="SUB_MANAGER">
                        <div className="flex flex-col">
                          <span className="font-medium">서브 관리자</span>
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
                  초대 생성 중...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  초대 보내기
                </div>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}




