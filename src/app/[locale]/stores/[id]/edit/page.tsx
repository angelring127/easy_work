"use client";

import { useEffect, useState } from "react";
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
import { WorkItemRoleManager } from "@/components/schedule/work-item-role-manager";
import { RolesEditor } from "@/components/schedule/roles-editor";
import { WorkItemsEditor } from "@/components/schedule/work-items-editor";

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
  const currentLocale = (locale as Locale) || "ko";
  const storeId = id as string;

  // URL 쿼리 파라미터에서 from 값 확인
  const searchParams = new URLSearchParams(window.location.search);
  const fromDashboard = searchParams.get("from") === "dashboard";

  const [store, setStore] = useState<StoreData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
  }, [user, storeId]);

  const loadStoreData = async () => {
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
  };

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
            <Tabs defaultValue="basic">
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
          .map(([field, errors]) => `${field}: ${errors?.join(", ")}`)
          .join(", ");
        if (fieldErrors) {
          errorMessage = `검증 오류: ${fieldErrors}`;
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
              <Label htmlFor={`open-${idx}`}>Open</Label>
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
              <Label htmlFor={`close-${idx}`}>Close</Label>
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

  const load = async () => {
    const res = await fetch(`/api/store-holidays?store_id=${storeId}`, {
      cache: "no-store",
    });
    if (res.ok) {
      const json = await res.json();
      setHolidays(json.data || []);
    }
  };
  useEffect(() => {
    load();
  }, [storeId]);

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
      <h3 className="text-lg font-semibold mb-4">Holidays</h3>
      <div className="flex items-end gap-2 mb-3">
        <div className="space-y-1">
          <Label htmlFor="holiday-date">Date</Label>
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
    freeze_hours_before_shift: 0,
    swap_lead_time_hours: 0,
    swap_require_same_role: false,
    swap_auto_approve_threshold: 0,
    min_rest_hours_between_shifts: 0,
    max_hours_per_day: 0,
    max_hours_per_week: 0,
    max_consecutive_days: 0,
    weekly_labor_budget_cents: 0,
    night_shift_boundary_min: 1320,
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
          freeze_hours_before_shift: s.freeze_hours_before_shift ?? 0,
          swap_lead_time_hours: s.swap_lead_time_hours ?? 0,
          swap_require_same_role: s.swap_require_same_role ?? false,
          swap_auto_approve_threshold: s.swap_auto_approve_threshold ?? 0,
          min_rest_hours_between_shifts: s.min_rest_hours_between_shifts ?? 0,
          max_hours_per_day: s.max_hours_per_day ?? 0,
          max_hours_per_week: s.max_hours_per_week ?? 0,
          max_consecutive_days: s.max_consecutive_days ?? 0,
          weekly_labor_budget_cents: s.weekly_labor_budget_cents ?? 0,
          night_shift_boundary_min: s.night_shift_boundary_min ?? 1320,
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
    <section className="space-y-4">
      <h3 className="text-lg font-semibold">
        {t("settings.store.policies", locale)}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(form).map(([key, value]) => (
          <div key={key} className="space-y-1">
            <Label>{key}</Label>
            <Input
              type={typeof value === "number" ? "number" : "text"}
              value={String(value)}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  [key]:
                    typeof value === "number"
                      ? Number(e.target.value || 0)
                      : e.target.value,
                }))
              }
            />
          </div>
        ))}
      </div>
      <Button onClick={save}>{t("common.save", locale)}</Button>
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

  const load = async () => {
    const res = await fetch(`/api/break-rules?store_id=${storeId}`, {
      cache: "no-store",
    });
    if (res.ok) {
      const json = await res.json();
      setItems(json.data || []);
    }
  };
  useEffect(() => {
    load();
  }, [storeId]);

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
