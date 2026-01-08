"use client";
import { defaultLocale } from "@/lib/i18n-config";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { usePermissions } from "@/hooks/use-permissions";
import { StoreForm } from "@/features/stores/components/store-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WorkItemRoleManager } from "@/components/schedule/work-item-role-manager";
import { RolesEditor } from "@/components/schedule/roles-editor";
import { WorkItemsEditor } from "@/components/schedule/work-items-editor";
import {
  getCurrencySymbol,
  getCurrencyName,
  type CurrencyUnit,
} from "@/lib/currency";

interface StoreData {
  id: string;
  name: string;
  description?: string;
  address?: string;
  phone?: string;
  timezone: string;
  status: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
  user_role?: string;
}

export default function EditStorePage() {
  const { locale, id } = useParams();
  const { user, loading } = useAuth();
  const { userRole } = usePermissions();
  const router = useRouter();
  const { toast } = useToast();
  const currentLocale = (locale as Locale) || defaultLocale;
  const storeId = id as string;

  // URL 쿼리 파라미터에서 from 값 확인
  const searchParams = new URLSearchParams(window.location.search);
  const fromDashboard = searchParams.get("from") === "dashboard";
  const tabParam = searchParams.get("tab");

  const [store, setStore] = useState<StoreData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadStoreData = useCallback(async () => {
    try {
      const response = await fetch(`/api/stores/${storeId}`);
      if (response.ok) {
        const data = await response.json();
        setStore(data.data);

        // 권한 확인: 마스터이거나 해당 매장의 소유자여야 함
        if (userRole !== "MASTER" && data.data.owner_id !== user?.id) {
          toast({
            title: t("common.error", currentLocale),
            description: t("store.noPermission", currentLocale),
            variant: "destructive",
          });
          router.push(`/${locale}/stores`);
        }
      } else {
        toast({
          title: t("common.error", currentLocale),
          description: t("store.loadError", currentLocale),
          variant: "destructive",
        });
        router.push(`/${locale}/stores`);
      }
    } catch (error) {
      console.error("매장 데이터 로드 오류:", error);
      toast({
        title: t("common.error", currentLocale),
        description: t("store.networkError", currentLocale),
        variant: "destructive",
      });
      router.push(`/${locale}/stores`);
    } finally {
      setIsLoading(false);
    }
  }, [storeId, userRole, user?.id, currentLocale, toast, router, locale]);

  // 로그인하지 않은 경우 로그인 페이지로 리다이렉트
  useEffect(() => {
    if (!loading && !user) {
      router.push(`/${locale}/login`);
    }
  }, [loading, user, router, locale]);

  // 매장 데이터 로드
  useEffect(() => {
    if (user && storeId) {
      loadStoreData();
    }
  }, [user, storeId, loadStoreData]);

  // 로딩 중인 경우
  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg font-medium text-gray-700">
            {t("common.loading", currentLocale)}
          </p>
        </div>
      </div>
    );
  }

  // 사용자가 없으면 리다이렉트 중이므로 아무것도 표시하지 않음
  if (!user) {
    return null;
  }

  // 매장이 없으면 404
  if (!store) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {t("store.notFound", currentLocale)}
          </h3>
          <p className="text-gray-600 mb-4">
            {t("store.notFoundDescription", currentLocale)}
          </p>
          <Button onClick={() => router.push(`/${locale}/stores`)}>
            {t("common.back", currentLocale)}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                onClick={() => {
                  // 대시보드에서 온 경우 대시보드로, 그렇지 않으면 매장 상세 페이지로
                  if (fromDashboard) {
                    router.push(`/${locale}/dashboard`);
                  } else {
                    router.push(`/${locale}/stores/${storeId}`);
                  }
                }}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>{t("common.back", currentLocale)}</span>
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {t("store.editTitle", currentLocale)}
                </h1>
                <p className="text-gray-600">
                  {t("store.editDescription", currentLocale)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <main className="max-w-5xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <Tabs defaultValue={tabParam || "basic"}>
              <TabsList className="flex flex-wrap gap-2">
                <TabsTrigger value="basic">
                  {t("settings.store.basic", currentLocale)}
                </TabsTrigger>
                <TabsTrigger value="hours">
                  {t("settings.store.hours", currentLocale)}
                </TabsTrigger>
                <TabsTrigger value="workItems">
                  {t("settings.store.workItems", currentLocale)}
                </TabsTrigger>
                <TabsTrigger value="roles">
                  {t("settings.store.roles", currentLocale)}
                </TabsTrigger>
                <TabsTrigger value="breakRules">
                  {t("settings.store.breakRules", currentLocale)}
                </TabsTrigger>
                <TabsTrigger value="policies">
                  {t("settings.store.policies", currentLocale)}
                </TabsTrigger>
                <TabsTrigger value="notifications">
                  {t("settings.store.notifications", currentLocale)}
                </TabsTrigger>
              </TabsList>

              {/* 기본 정보 */}
              <TabsContent value="basic" className="pt-4">
                <StoreForm
                  mode="edit"
                  storeId={storeId}
                  initialData={store}
                  onSuccess={() => {
                    toast({
                      title: t("settings.store.saveSuccess", currentLocale),
                    });
                  }}
                />
              </TabsContent>

              {/* 영업시간/휴무 */}
              <TabsContent value="hours" className="pt-4 space-y-8">
                <HoursEditor storeId={storeId} locale={currentLocale} />
                <Separator />
                <HolidaysEditor storeId={storeId} locale={currentLocale} />
              </TabsContent>

              {/* 근무 항목 탭 */}
              <TabsContent
                value="workItems"
                className="pt-4 text-sm text-gray-600"
              >
                <WorkItemsEditor storeId={storeId} locale={currentLocale} />
              </TabsContent>
              <TabsContent value="roles" className="pt-4 text-sm text-gray-600">
                <RolesEditor storeId={storeId} locale={currentLocale} />
              </TabsContent>
              <TabsContent
                value="breakRules"
                className="pt-4 text-sm text-gray-600"
              >
                <BreakRulesEditor storeId={storeId} locale={currentLocale} />
              </TabsContent>
              <TabsContent
                value="policies"
                className="pt-4 text-sm text-gray-600"
              >
                <PoliciesEditor storeId={storeId} locale={currentLocale} />
              </TabsContent>
              <TabsContent
                value="notifications"
                className="pt-4 text-sm text-gray-600"
              >
                <p>{t("common.loading", currentLocale)}...</p>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  );
}

// --- 간단 Hours/Holidays/Policies 에디터 (1차 스켈레톤) ---

function MinutesInput({
  value,
  onChange,
  id,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  id: string;
  label: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={0}
        max={1440}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value || "0", 10))}
      />
    </div>
  );
}

function HoursEditor({ storeId, locale }: { storeId: string; locale: Locale }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<
    Array<{ weekday: number; openMin: number; closeMin: number }>
  >([
    { weekday: 0, openMin: 540, closeMin: 1320 },
    { weekday: 1, openMin: 540, closeMin: 1320 },
    { weekday: 2, openMin: 540, closeMin: 1320 },
    { weekday: 3, openMin: 540, closeMin: 1320 },
    { weekday: 4, openMin: 540, closeMin: 1320 },
    { weekday: 5, openMin: 540, closeMin: 1320 },
    { weekday: 6, openMin: 540, closeMin: 1320 },
  ]);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/store-business-hours?store_id=${storeId}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const json = await res.json();
        const map = new Map<number, { open_min: number; close_min: number }>();
        (json.data || []).forEach((r: any) =>
          map.set(r.weekday, { open_min: r.open_min, close_min: r.close_min })
        );
        setRows((prev) =>
          prev.map((r) => ({
            weekday: r.weekday,
            openMin: map.get(r.weekday)?.open_min ?? r.openMin,
            closeMin: map.get(r.weekday)?.close_min ?? r.closeMin,
          }))
        );
      }
    })();
  }, [storeId]);

  const save = async () => {
    const payload = rows.map((r) => ({
      storeId,
      weekday: r.weekday,
      openMin: r.openMin,
      closeMin: r.closeMin,
    }));

    console.log("영업시간 저장 요청:", payload);

    const res = await fetch(`/api/store-business-hours`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      toast({ title: t("settings.store.saveSuccess", locale) });
    } else {
      const errorData = await res.json();
      console.error("영업시간 저장 실패:", errorData);

      let errorMessage = t("settings.store.saveError", locale);
      if (errorData.details) {
        // 검증 오류 상세 정보 표시
        const fieldErrors = Object.entries(errorData.details.fieldErrors || {})
          .map(
            ([field, errors]) =>
              `${field}: ${
                Array.isArray(errors) ? errors.join(", ") : String(errors)
              }`
          )
          .join(", ");
        if (fieldErrors) {
          errorMessage = `${t("settings.store.validationError", locale)}: ${fieldErrors}`;
        }
      }

      toast({
        title: t("common.error", locale),
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  return (
    <section>
      <h3 className="text-lg font-semibold mb-4">
        {t("settings.store.hours", locale)}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {rows.map((r, idx) => (
          <div key={r.weekday} className="border rounded p-3 space-y-2">
            <div className="text-sm text-gray-700">
              {t("targets.weekday", locale)}:{" "}
              {getWeekdayName(r.weekday, locale)}
            </div>
            <div className="space-y-1">
              <Label htmlFor={`open-${idx}`}>{t("settings.store.open", locale)}</Label>
              <Input
                id={`open-${idx}`}
                type="time"
                value={minutesToTime(r.openMin)}
                onChange={(e) => {
                  const newOpenMin = timeToMinutes(e.target.value);
                  setRows((arr) =>
                    arr.map((x, i) =>
                      i === idx
                        ? {
                            ...x,
                            openMin: newOpenMin,
                            // 시작 시간과 종료 시간이 같으면 종료 시간을 1시간 후로 설정
                            closeMin:
                              newOpenMin === x.closeMin
                                ? newOpenMin + 60
                                : x.closeMin,
                          }
                        : x
                    )
                  );
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`close-${idx}`}>{t("settings.store.close", locale)}</Label>
              <Input
                id={`close-${idx}`}
                type="time"
                value={minutesToTime(r.closeMin)}
                onChange={(e) => {
                  const newCloseMin = timeToMinutes(e.target.value);
                  setRows((arr) =>
                    arr.map((x, i) =>
                      i === idx
                        ? {
                            ...x,
                            closeMin: newCloseMin,
                            // 시작 시간과 종료 시간이 같으면 시작 시간을 1시간 전으로 설정
                            openMin:
                              newCloseMin === x.openMin
                                ? Math.max(0, newCloseMin - 60)
                                : x.openMin,
                          }
                        : x
                    )
                  );
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <Button onClick={save}>{t("common.save", locale)}</Button>
      </div>
    </section>
  );
}

// 유틸: 요일 번호 → 요일명
function getWeekdayName(weekday: number, locale: Locale): string {
  const names: Record<Locale, string[]> = {
    ko: ["일", "월", "화", "수", "목", "금", "토"],
    en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    ja: ["日", "月", "火", "水", "木", "金", "土"],
  };
  return names[locale]?.[weekday] ?? String(weekday);
}

// 유틸: 분 ↔ HH:mm 변환
function minutesToTime(mins: number): string {
  const m = Math.max(0, Math.min(1440, Math.floor(mins)));
  const h = Math.floor(m / 60)
    .toString()
    .padStart(2, "0");
  const mm = (m % 60).toString().padStart(2, "0");
  return `${h}:${mm}`;
}

function timeToMinutes(value: string): number {
  const [h, m] = value.split(":").map((v) => parseInt(v || "0", 10));
  const mins = (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
  return Math.max(0, Math.min(1440, mins));
}

function HolidaysEditor({
  storeId,
  locale,
}: {
  storeId: string;
  locale: Locale;
}) {
  const { toast } = useToast();
  const [holidays, setHolidays] = useState<Array<{ id: string; date: string }>>(
    []
  );
  const [date, setDate] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/store-holidays?store_id=${storeId}`, {
      cache: "no-store",
    });
    if (res.ok) {
      const json = await res.json();
      setHolidays(json.data || []);
    }
  }, [storeId]);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    if (!date) return;
    const res = await fetch(`/api/store-holidays`, {
      method: "POST",
      body: JSON.stringify({ storeId, date }),
    });
    if (res.ok) {
      setDate("");
      await load();
      toast({ title: t("settings.store.saveSuccess", locale) });
    } else {
      toast({
        title: t("common.error", locale),
        description: t("settings.store.saveError", locale),
        variant: "destructive",
      });
    }
  };
  const remove = async (id: string) => {
    const res = await fetch(`/api/store-holidays?id=${id}`, {
      method: "DELETE",
    });
    if (res.ok) await load();
  };

  return (
    <section>
      <h3 className="text-lg font-semibold mb-4">{t("settings.store.holidays", locale)}</h3>
      <div className="flex items-end gap-2 mb-3">
        <div className="space-y-1">
          <Label htmlFor="holiday-date">{t("settings.store.date", locale)}</Label>
          <Input
            id="holiday-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <Button onClick={add}>{t("common.add", locale)}</Button>
      </div>
      <ul className="space-y-2">
        {holidays.map((h) => (
          <li
            key={h.id}
            className="flex justify-between items-center border rounded p-2"
          >
            <span>{h.date}</span>
            <Button variant="destructive" onClick={() => remove(h.id)}>
              {t("common.delete", locale)}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PoliciesEditor({
  storeId,
  locale,
}: {
  storeId: string;
  locale: Locale;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    publish_cutoff_hours: 0,
    swap_lead_time_hours: 0,
    min_rest_hours_between_shifts: 0,
    max_hours_per_day: 0,
    max_hours_per_week: 0,
    max_hours_per_month: 160,
    max_consecutive_days: 0,
    weekly_labor_budget_cents: 0,
    schedule_unit: "week" as "week" | "month",
    currency_unit: "KRW" as CurrencyUnit,
    shift_boundary_time_min: 720, // 12:00 기본값
    max_morning_staff: 0,
    max_afternoon_staff: 0,
    min_morning_staff: 0,
    min_afternoon_staff: 0,
  });

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/stores/${storeId}`);
      if (res.ok) {
        const json = await res.json();
        const s = json.data;
        setForm((f) => ({
          ...f,
          publish_cutoff_hours: s.publish_cutoff_hours ?? 0,
          swap_lead_time_hours: s.swap_lead_time_hours ?? 0,
          min_rest_hours_between_shifts: s.min_rest_hours_between_shifts ?? 0,
          max_hours_per_day: s.max_hours_per_day ?? 0,
          max_hours_per_week: s.max_hours_per_week ?? 0,
          max_hours_per_month: s.max_hours_per_month ?? 160,
          max_consecutive_days: s.max_consecutive_days ?? 0,
          weekly_labor_budget_cents: s.weekly_labor_budget_cents ?? 0,
          schedule_unit: s.schedule_unit ?? "week",
          currency_unit: s.currency_unit ?? "KRW",
          shift_boundary_time_min: s.shift_boundary_time_min ?? 720,
          max_morning_staff: s.max_morning_staff ?? 0,
          max_afternoon_staff: s.max_afternoon_staff ?? 0,
          min_morning_staff: s.min_morning_staff ?? 0,
          min_afternoon_staff: s.min_afternoon_staff ?? 0,
        }));
      }
    })();
  }, [storeId]);

  const save = async () => {
    const res = await fetch(`/api/stores/${storeId}`, {
      method: "PATCH",
      body: JSON.stringify(form),
    });
    if (res.ok) toast({ title: t("settings.store.saveSuccess", locale) });
    else
      toast({
        title: t("common.error", locale),
        description: t("settings.store.saveError", locale),
        variant: "destructive",
      });
  };

  return (
    <section className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">
          {t("settings.store.policies", locale)}
        </h3>
        <p className="text-sm text-gray-600 mb-6">
          {t("settings.store.policiesDescription", locale)}
        </p>
      </div>

      <div className="space-y-6">
        {/* 기본 설정 그룹 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("policies.group.basicSettings", locale)}
            </CardTitle>
            <CardDescription>
              {t("policies.group.basicSettingsDesc", locale)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 스케줄 단위 설정 */}
        <div className="space-y-2">
          <Label htmlFor="schedule_unit" className="text-gray-400">
            {t("policies.schedule_unit", locale)}
          </Label>
          <Select
            value={form.schedule_unit}
            onValueChange={(value: "week" | "month") =>
              setForm((prev) => ({ ...prev, schedule_unit: value }))
            }
            disabled
          >
            <SelectTrigger className="bg-gray-50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">
                {t("policies.schedule_unit_week", locale)}
              </SelectItem>
              <SelectItem value="month">
                {t("policies.schedule_unit_month", locale)}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 통화 단위 설정 */}
        <div className="space-y-2">
          <Label htmlFor="currency_unit" className="text-gray-400">
            {t("policies.currency_unit", locale)}
          </Label>
          <Select
            value={form.currency_unit}
            onValueChange={(value: CurrencyUnit) =>
              setForm((prev) => ({ ...prev, currency_unit: value }))
            }
            disabled
          >
            <SelectTrigger className="bg-gray-50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="KRW">
                {t("policies.currency_krw", locale)} ({getCurrencySymbol("KRW")})
              </SelectItem>
              <SelectItem value="USD">
                {t("policies.currency_usd", locale)} ({getCurrencySymbol("USD")})
              </SelectItem>
              <SelectItem value="JPY">
                {t("policies.currency_jpy", locale)} ({getCurrencySymbol("JPY")})
              </SelectItem>
              <SelectItem value="EUR">
                {t("policies.currency_eur", locale)} ({getCurrencySymbol("EUR")})
              </SelectItem>
              <SelectItem value="CAD">
                {t("policies.currency_cad", locale)} ({getCurrencySymbol("CAD")})
              </SelectItem>
              <SelectItem value="AUD">
                {t("policies.currency_aud", locale)} ({getCurrencySymbol("AUD")})
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-400">
            {t("settings.store.currencyUnitDesc", locale)}
          </p>
        </div>

        {/* 오전/오후 구분 시간 설정 */}
        <div className="space-y-2">
          <Label htmlFor="shift_boundary_time">
            {t("policies.shift_boundary_time", locale)}
          </Label>
          <div className="flex gap-2 items-center">
            <Input
              id="shift_boundary_time_hour"
              type="number"
              min="0"
              max="23"
              value={Math.floor(form.shift_boundary_time_min / 60)}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  shift_boundary_time_min:
                    parseInt(e.target.value || "0") * 60 +
                    (prev.shift_boundary_time_min % 60),
                }))
              }
              className="w-20"
            />
            <span>:</span>
            <Input
              id="shift_boundary_time_minute"
              type="number"
              min="0"
              max="59"
              value={form.shift_boundary_time_min % 60}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  shift_boundary_time_min:
                    Math.floor(prev.shift_boundary_time_min / 60) * 60 +
                    parseInt(e.target.value || "0"),
                }))
              }
              className="w-20"
            />
            <span className="text-sm text-gray-500">
              (
              {Math.floor(form.shift_boundary_time_min / 60)
                .toString()
                .padStart(2, "0")}
              :{(form.shift_boundary_time_min % 60).toString().padStart(2, "0")}
              )
            </span>
          </div>
          <p className="text-xs text-gray-500">
            {t("policies.shift_boundary_time_desc", locale)}
          </p>
        </div>
            </div>
          </CardContent>
        </Card>

        {/* 스케줄 게시 그룹 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("policies.group.schedulePublishing", locale)}
            </CardTitle>
            <CardDescription>
              {t("policies.group.schedulePublishingDesc", locale)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 게시 마감 시간 */}
        <div className="space-y-2">
          <Label htmlFor="publish_cutoff_hours" className="text-gray-400">
            {t("policies.publish_cutoff_hours", locale)}
          </Label>
          <Input
            id="publish_cutoff_hours"
            type="number"
            min="0"
            value={form.publish_cutoff_hours}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                publish_cutoff_hours: Number(e.target.value || 0),
              }))
            }
            disabled
            className="bg-gray-50"
          />
          <p className="text-xs text-gray-400">
            {t("settings.store.publishCutoffDesc", locale)}
          </p>
        </div>
            </div>
          </CardContent>
        </Card>

        {/* 근무 시간 제한 그룹 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("policies.group.workHoursLimits", locale)}
            </CardTitle>
            <CardDescription>
              {t("policies.group.workHoursLimitsDesc", locale)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 주 최대 근무 시간 */}
        <div className="space-y-2">
          <Label htmlFor="max_hours_per_week">
            {t("policies.max_hours_per_week", locale)}
          </Label>
          <Input
            id="max_hours_per_week"
            type="number"
            min="0"
            value={form.max_hours_per_week}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                max_hours_per_week: Number(e.target.value || 0),
              }))
            }
          />
          <p className="text-xs text-gray-500">
            {t("settings.store.maxHoursPerWeekDesc", locale)}
          </p>
        </div>

        {/* 월 최대 근무 시간 */}
        <div className="space-y-2">
          <Label htmlFor="max_hours_per_month">
            {t("rules.compliance.maxPerMonth", locale)}
          </Label>
          <Input
            id="max_hours_per_month"
            type="number"
            min="1"
            max="999.99"
            step="0.01"
            value={form.max_hours_per_month}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                max_hours_per_month: Number(e.target.value || 160),
              }))
            }
          />
          <p className="text-xs text-gray-500">
            {t("settings.store.maxHoursPerMonthDesc", locale)}
          </p>
        </div>

        {/* 연속 근무 최대 일수 */}
        <div className="space-y-2">
          <Label htmlFor="max_consecutive_days" className="text-gray-400">
            {t("policies.max_consecutive_days", locale)}
          </Label>
          <Input
            id="max_consecutive_days"
            type="number"
            min="0"
            value={form.max_consecutive_days}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                max_consecutive_days: Number(e.target.value || 0),
              }))
            }
            disabled
            className="bg-gray-50"
          />
          <p className="text-xs text-gray-400">
            {t("settings.store.maxConsecutiveDaysDesc", locale)}
          </p>
        </div>
            </div>
          </CardContent>
        </Card>

        {/* 인원 관리 그룹 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("policies.group.staffManagement", locale)}
            </CardTitle>
            <CardDescription>
              {t("policies.group.staffManagementDesc", locale)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 오전 최대 근무 인원 */}
        <div className="space-y-2">
          <Label htmlFor="max_morning_staff">
            {t("policies.max_morning_staff", locale)}
          </Label>
          <Input
            id="max_morning_staff"
            type="number"
            min="0"
            max="999"
            value={form.max_morning_staff}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                max_morning_staff: Number(e.target.value || 0),
              }))
            }
          />
          <p className="text-xs text-gray-500">
            {t("policies.max_morning_staff_desc", locale)}
          </p>
        </div>

        {/* 오전 최소 근무 인원 */}
        <div className="space-y-2">
          <Label htmlFor="min_morning_staff">
            {t("policies.min_morning_staff", locale)}
          </Label>
          <Input
            id="min_morning_staff"
            type="number"
            min="0"
            max="999"
            value={form.min_morning_staff}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                min_morning_staff: Number(e.target.value || 0),
              }))
            }
          />
          <p className="text-xs text-gray-500">
            {t("policies.min_morning_staff_desc", locale)}
          </p>
        </div>

        {/* 오후 최대 근무 인원 */}
        <div className="space-y-2">
          <Label htmlFor="max_afternoon_staff">
            {t("policies.max_afternoon_staff", locale)}
          </Label>
          <Input
            id="max_afternoon_staff"
            type="number"
            min="0"
            max="999"
            value={form.max_afternoon_staff}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                max_afternoon_staff: Number(e.target.value || 0),
              }))
            }
          />
          <p className="text-xs text-gray-500">
            {t("policies.max_afternoon_staff_desc", locale)}
          </p>
        </div>

        {/* 오후 최소 근무 인원 */}
        <div className="space-y-2">
          <Label htmlFor="min_afternoon_staff">
            {t("policies.min_afternoon_staff", locale)}
          </Label>
          <Input
            id="min_afternoon_staff"
            type="number"
            min="0"
            max="999"
            value={form.min_afternoon_staff}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                min_afternoon_staff: Number(e.target.value || 0),
              }))
            }
          />
          <p className="text-xs text-gray-500">
            {t("policies.min_afternoon_staff_desc", locale)}
          </p>
        </div>
            </div>
          </CardContent>
        </Card>

        {/* 미사용 항목 그룹 */}
        <Card className="opacity-60">
          <CardHeader>
            <CardTitle className="text-base text-gray-400">
              {t("policies.group.unusedSettings", locale)}
            </CardTitle>
            <CardDescription className="text-gray-400">
              {t("policies.group.unusedSettingsDesc", locale)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 교대 요청 리드타임 */}
        <div className="space-y-2">
          <Label htmlFor="swap_lead_time_hours" className="text-gray-400">
            {t("policies.swap_lead_time_hours", locale)}
          </Label>
          <Input
            id="swap_lead_time_hours"
            type="number"
            min="0"
            value={form.swap_lead_time_hours}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                swap_lead_time_hours: Number(e.target.value || 0),
              }))
            }
            disabled
            className="bg-gray-50"
          />
          <p className="text-xs text-gray-400">
            {t("settings.store.swapLeadTimeDesc", locale)}
          </p>
        </div>

        {/* 근무 간 최소 휴식 */}
        <div className="space-y-2">
          <Label htmlFor="min_rest_hours_between_shifts" className="text-gray-400">
            {t("policies.min_rest_hours_between_shifts", locale)}
          </Label>
          <Input
            id="min_rest_hours_between_shifts"
            type="number"
            min="0"
            value={form.min_rest_hours_between_shifts}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                min_rest_hours_between_shifts: Number(e.target.value || 0),
              }))
            }
            disabled
            className="bg-gray-50"
          />
          <p className="text-xs text-gray-400">{t("settings.store.minRestDesc", locale)}</p>
        </div>

        {/* 일 최대 근무 시간 */}
        <div className="space-y-2">
          <Label htmlFor="max_hours_per_day" className="text-gray-400">
            {t("policies.max_hours_per_day", locale)}
          </Label>
          <Input
            id="max_hours_per_day"
            type="number"
            min="0"
            value={form.max_hours_per_day}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                max_hours_per_day: Number(e.target.value || 0),
              }))
            }
            disabled
            className="bg-gray-50"
          />
          <p className="text-xs text-gray-400">
            {t("settings.store.maxHoursPerDayDesc", locale)}
          </p>
        </div>

        {/* 주간 인건비 예산 */}
        <div className="space-y-2">
          <Label htmlFor="weekly_labor_budget_cents" className="text-gray-400">
            {t("policies.weekly_labor_budget_cents", locale)}
          </Label>
          <div className="relative">
            <Input
              id="weekly_labor_budget_cents"
              type="number"
              min="0"
              value={form.weekly_labor_budget_cents}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  weekly_labor_budget_cents: Number(e.target.value || 0),
                }))
              }
              className="pr-16 bg-gray-50"
              disabled
            />
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-gray-400">
              {getCurrencySymbol(form.currency_unit)}
            </div>
          </div>
          <p className="text-xs text-gray-400">
            {t("settings.store.weeklyBudgetDesc", locale).replace(
              "{currency}",
              getCurrencyName(form.currency_unit)
            )}
          </p>
        </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={save}>{t("common.save", locale)}</Button>
      </div>
    </section>
  );
}

// 기존 WorkItemsEditor 함수는 새로운 컴포넌트로 대체됨

function BreakRulesEditor({
  storeId,
  locale,
}: {
  storeId: string;
  locale: Locale;
}) {
  const { toast } = useToast();
  const [items, setItems] = useState<Array<any>>([]);
  const [form, setForm] = useState({
    thresholdHours: 6,
    breakMin: 30,
    paid: false,
  });

  const load = useCallback(async () => {
    const res = await fetch(`/api/break-rules?store_id=${storeId}`, {
      cache: "no-store",
    });
    if (res.ok) {
      const json = await res.json();
      setItems(json.data || []);
    }
  }, [storeId]);

  useEffect(() => {
    load();
  }, [load]);

  const createItem = async () => {
    const res = await fetch(`/api/break-rules`, {
      method: "POST",
      body: JSON.stringify({ storeId, ...form }),
    });
    if (res.ok) {
      toast({ title: t("settings.store.saveSuccess", locale) });
      await load();
    }
  };
  const updateItem = async (id: string, patch: any) => {
    const res = await fetch(`/api/break-rules/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    if (res.ok) await load();
  };
  const deleteItem = async (id: string) => {
    const res = await fetch(`/api/break-rules/${id}`, { method: "DELETE" });
    if (res.ok) await load();
  };

  return (
    <section className="space-y-6">
      <h3 className="text-lg font-semibold">{t("rules.title", locale)}</h3>
      <div className="border rounded p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="space-y-1">
          <Label>{t("rules.break.threshold", locale)}</Label>
          <Input
            type="number"
            min={0}
            max={24}
            value={form.thresholdHours}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                thresholdHours: Number(e.target.value || 0),
              }))
            }
          />
        </div>
        <div className="space-y-1">
          <Label>{t("rules.break.breakMin", locale)}</Label>
          <Input
            type="number"
            min={0}
            max={240}
            value={form.breakMin}
            onChange={(e) =>
              setForm((f) => ({ ...f, breakMin: Number(e.target.value || 0) }))
            }
          />
        </div>
        <div className="space-y-1">
          <Label>{t("rules.break.paid", locale)}</Label>
          <Input
            type="checkbox"
            checked={form.paid}
            onChange={(e) => setForm((f) => ({ ...f, paid: e.target.checked }))}
          />
        </div>
        <div className="md:col-span-1 flex items-end">
          <Button onClick={createItem}>{t("common.add", locale)}</Button>
        </div>
      </div>

      <div className="border rounded">
        <div className="grid grid-cols-5 gap-2 p-2 bg-gray-50 text-sm font-medium">
          <div>{t("rules.break.threshold", locale)}</div>
          <div>{t("rules.break.breakMin", locale)}</div>
          <div>{t("rules.break.paid", locale)}</div>
          <div></div>
          <div></div>
        </div>
        <div className="divide-y">
          {items.map((it: any) => (
            <div
              key={it.id}
              className="grid grid-cols-5 gap-2 p-2 items-center"
            >
              <Input
                type="number"
                value={it.threshold_hours}
                onChange={(e) =>
                  setItems((arr) =>
                    arr.map((x) =>
                      x.id === it.id
                        ? { ...x, threshold_hours: Number(e.target.value || 0) }
                        : x
                    )
                  )
                }
              />
              <Input
                type="number"
                value={it.break_min}
                onChange={(e) =>
                  setItems((arr) =>
                    arr.map((x) =>
                      x.id === it.id
                        ? { ...x, break_min: Number(e.target.value || 0) }
                        : x
                    )
                  )
                }
              />
              <Input
                type="checkbox"
                checked={!!it.paid}
                onChange={(e) =>
                  setItems((arr) =>
                    arr.map((x) =>
                      x.id === it.id ? { ...x, paid: e.target.checked } : x
                    )
                  )
                }
              />
              <Button
                variant="secondary"
                onClick={() =>
                  updateItem(it.id, {
                    thresholdHours: it.threshold_hours,
                    breakMin: it.break_min,
                    paid: !!it.paid,
                  })
                }
              >
                {t("common.save", locale)}
              </Button>
              <Button variant="destructive" onClick={() => deleteItem(it.id)}>
                {t("common.delete", locale)}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
