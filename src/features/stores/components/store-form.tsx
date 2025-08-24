"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useStore } from "@/contexts/store-context";
import { Store } from "@/lib/supabase/types";
import { t, type Locale } from "@/lib/i18n";
import { useParams } from "next/navigation";
import { Loader2, Save, Plus } from "lucide-react";

// 매장 폼 스키마
const storeFormSchema = z.object({
  name: z
    .string()
    .min(1, "매장명은 필수입니다")
    .max(255, "매장명은 255자 이하여야 합니다"),
  description: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  timezone: z.string().default("Asia/Seoul"),
});

type StoreFormData = z.infer<typeof storeFormSchema>;

interface StoreFormProps {
  mode?: "create" | "edit";
  storeId?: string;
  initialData?: any;
  onSuccess?: (store: Store) => void;
  onCancel?: () => void;
  className?: string;
  // 레거시 지원
  store?: Store;
}

export function StoreForm({
  mode = "create",
  storeId,
  initialData,
  onSuccess,
  onCancel,
  className,
  store, // 레거시 지원
}: StoreFormProps) {
  const { locale } = useParams();
  const currentLocale = (locale as Locale) || "ko";
  const { toast } = useToast();
  const { addStore, updateStore } = useStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 레거시 지원: store prop이 있으면 edit 모드로 설정
  const isEditing = mode === "edit" || !!store;
  const storeData = initialData || store;

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<StoreFormData>({
    resolver: zodResolver(storeFormSchema),
    defaultValues: {
      name: storeData?.name || "",
      description: storeData?.description || "",
      address: storeData?.address || "",
      phone: storeData?.phone || "",
      timezone: storeData?.timezone || "Asia/Seoul",
    },
  });

  const timezone = watch("timezone");

  // 타임존 옵션
  const timezoneOptions = [
    { value: "Asia/Seoul", label: "Asia/Seoul (UTC+9)" },
    { value: "Asia/Tokyo", label: "Asia/Tokyo (UTC+9)" },
    { value: "America/New_York", label: "America/New_York (UTC-5)" },
    { value: "America/Los_Angeles", label: "America/Los_Angeles (UTC-8)" },
    { value: "Europe/London", label: "Europe/London (UTC+0)" },
    { value: "Europe/Paris", label: "Europe/Paris (UTC+1)" },
  ];

  const onSubmit = async (data: StoreFormData) => {
    setIsSubmitting(true);
    try {
      if (isEditing) {
        // 매장 수정
        const targetStoreId = storeId || store?.id;
        if (!targetStoreId) {
          throw new Error("Store ID is required for editing");
        }

        const response = await fetch(`/api/stores/${targetStoreId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        });

        const result = await response.json();

        if (result.success) {
          toast({
            title: t("store.updateSuccess", currentLocale),
            description: result.message,
          });

          // 컨텍스트 업데이트
          updateStore(targetStoreId, result.data);
          onSuccess?.(result.data);
        } else {
          toast({
            title: t("store.updateError", currentLocale),
            description: result.error,
            variant: "destructive",
          });
        }
      } else {
        // 매장 생성
        const response = await fetch("/api/stores", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        });

        const result = await response.json();

        if (result.success) {
          toast({
            title: t("store.createSuccess", currentLocale),
            description: result.message,
          });

          // 컨텍스트에 추가
          addStore(result.data);
          onSuccess?.(result.data);
        } else {
          toast({
            title: t("store.createError", currentLocale),
            description: result.error,
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error("매장 저장 오류:", error);
      toast({
        title: t("store.saveError", currentLocale),
        description: t("store.networkError", currentLocale),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Save className="h-5 w-5" />
              {t("store.editTitle", currentLocale)}
            </>
          ) : (
            <>
              <Plus className="h-5 w-5" />
              {t("store.createTitle", currentLocale)}
            </>
          )}
        </CardTitle>
        <CardDescription>
          {isEditing
            ? t("store.editDescription", currentLocale)
            : t("store.createDescription", currentLocale)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* 매장명 */}
          <div className="space-y-2">
            <Label htmlFor="name">{t("store.name", currentLocale)} *</Label>
            <Input
              id="name"
              {...register("name")}
              placeholder={t("store.namePlaceholder", currentLocale)}
              className={errors.name ? "border-red-500" : ""}
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          {/* 설명 */}
          <div className="space-y-2">
            <Label htmlFor="description">
              {t("store.description", currentLocale)}
            </Label>
            <Textarea
              id="description"
              {...register("description")}
              placeholder={t("store.descriptionPlaceholder", currentLocale)}
              rows={3}
            />
          </div>

          {/* 주소 */}
          <div className="space-y-2">
            <Label htmlFor="address">{t("store.address", currentLocale)}</Label>
            <Input
              id="address"
              {...register("address")}
              placeholder={t("store.addressPlaceholder", currentLocale)}
            />
          </div>

          {/* 전화번호 */}
          <div className="space-y-2">
            <Label htmlFor="phone">{t("store.phone", currentLocale)}</Label>
            <Input
              id="phone"
              {...register("phone")}
              placeholder={t("store.phonePlaceholder", currentLocale)}
            />
          </div>

          {/* 타임존 */}
          <div className="space-y-2">
            <Label htmlFor="timezone">
              {t("store.timezone", currentLocale)}
            </Label>
            <Select
              value={timezone}
              onValueChange={(value) => setValue("timezone", value)}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={t("store.timezonePlaceholder", currentLocale)}
                />
              </SelectTrigger>
              <SelectContent>
                {timezoneOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 버튼 */}
          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isEditing
                ? t("store.updateButton", currentLocale)
                : t("store.createButton", currentLocale)}
            </Button>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                {t("common.cancel", currentLocale)}
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
