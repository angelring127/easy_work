"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  getWeekOfMonth,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
} from "date-fns";
import { ArrowLeft, BarChart3, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ResponsiveHeader } from "@/components/layout/responsive-header";
import { useAuth } from "@/contexts/auth-context";
import { useStore } from "@/contexts/store-context";
import { t, type Locale } from "@/lib/i18n";
import { UserRole } from "@/types/auth";

interface AnalyticsUserHours {
  userId: string;
  userName: string;
  hours: number;
}

interface AnalyticsData {
  summary: {
    weeklyTotalHours: number;
    monthlyTotalHours: number;
  };
  weeklyByUser: AnalyticsUserHours[];
  monthlyByUser: AnalyticsUserHours[];
  period: {
    weekFrom: string;
    weekTo: string;
    monthFrom: string;
    monthTo: string;
  };
}

export default function AnalyticsPage() {
  const { locale } = useParams();
  const currentLocale = locale as Locale;
  const router = useRouter();
  const { user } = useAuth();
  const { currentStore } = useStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [weekBaseDate, setWeekBaseDate] = useState(new Date());
  const [monthBaseDate, setMonthBaseDate] = useState(new Date());
  const [weekPickerOpen, setWeekPickerOpen] = useState(false);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [pendingWeekValue, setPendingWeekValue] = useState("");
  const [pendingMonthValue, setPendingMonthValue] = useState("");

  const weekFrom = useMemo(
    () => format(startOfWeek(weekBaseDate, { weekStartsOn: 1 }), "yyyy-MM-dd"),
    [weekBaseDate]
  );
  const weekTo = useMemo(
    () => format(endOfWeek(weekBaseDate, { weekStartsOn: 1 }), "yyyy-MM-dd"),
    [weekBaseDate]
  );
  const monthFrom = useMemo(
    () => format(startOfMonth(monthBaseDate), "yyyy-MM-dd"),
    [monthBaseDate]
  );
  const monthTo = useMemo(
    () => format(endOfMonth(monthBaseDate), "yyyy-MM-dd"),
    [monthBaseDate]
  );

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push(`/${locale}/login`);
    } catch (logoutError) {
      console.error("Logout error:", logoutError);
    }
  };

  const weekOptions = useMemo(() => {
    return Array.from({ length: 25 }, (_, idx) => {
      const offset = idx - 12;
      const base = addWeeks(weekBaseDate, offset);
      const start = startOfWeek(base, { weekStartsOn: 1 });
      const end = endOfWeek(base, { weekStartsOn: 1 });
      const value = format(start, "yyyy-MM-dd");
      const month = format(start, "M");
      const week = String(getWeekOfMonth(start, { weekStartsOn: 1 }));
      const weekMeta = t("schedule.weekOfMonth", currentLocale, { month, week });
      const label = `${weekMeta} (${format(start, "MM/dd")} - ${format(end, "MM/dd")})`;
      return { value, label };
    });
  }, [weekBaseDate, currentLocale]);

  const monthOptions = useMemo(() => {
    return Array.from({ length: 25 }, (_, idx) => {
      const offset = idx - 12;
      const base = addMonths(monthBaseDate, offset);
      const start = startOfMonth(base);
      const value = format(start, "yyyy-MM");
      const label = `${format(start, "yyyy-MM")} (${format(
        start,
        "MM/dd"
      )} - ${format(endOfMonth(base), "MM/dd")})`;
      return { value, label };
    });
  }, [monthBaseDate]);

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!currentStore?.id) {
        setLoading(false);
        return;
      }

      if (user?.role === UserRole.PART_TIMER) {
        setLoading(false);
        setError(t("store.noPermission", currentLocale));
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          store_id: currentStore.id,
          week_from: weekFrom,
          week_to: weekTo,
          month_from: monthFrom,
          month_to: monthTo,
        });

        const response = await fetch(`/api/analytics/work-hours?${params}`);
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || t("analytics.loadError", currentLocale));
        }

        setData(result.data);
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : t("analytics.loadError", currentLocale));
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [currentStore?.id, weekFrom, weekTo, monthFrom, monthTo, currentLocale, user?.role]);

  return (
    <>
      <ResponsiveHeader
        userEmail={user?.email}
        currentStoreRole={user?.role as UserRole | undefined}
        locale={locale as string}
        onLogout={handleLogout}
      />

      <div className="container mx-auto p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex items-center gap-2 md:gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/${locale}/dashboard`)}
            className="flex items-center gap-2 min-h-[44px] touch-manipulation"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">{t("common.back", currentLocale)}</span>
          </Button>
          <div className="flex-1">
            <h1 className="text-xl md:text-3xl font-bold flex items-center gap-2">
              <BarChart3 className="h-5 w-5 md:h-7 md:w-7" />
              {t("analytics.title", currentLocale)}
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground">
              {currentStore?.name || t("schedule.noStoreSelected", currentLocale)}
            </p>
          </div>
        </div>

        {!currentStore?.id && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              {t("schedule.noStoreSelected", currentLocale)}
            </CardContent>
          </Card>
        )}

        {currentStore?.id && loading && (
          <Card>
            <CardContent className="py-8">
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{t("common.loading", currentLocale)}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStore?.id && !loading && error && (
          <Card>
            <CardContent className="py-8 text-center text-destructive">
              {t("analytics.loadError", currentLocale)}: {error}
            </CardContent>
          </Card>
        )}

        {currentStore?.id && !loading && !error && data && (
          <>
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm font-medium">
                    {t("analytics.weeklyTotalHours", currentLocale)}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setWeekBaseDate((prev) => subWeeks(prev, 1))}
                    >
                      ←
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPendingWeekValue(
                          format(startOfWeek(weekBaseDate, { weekStartsOn: 1 }), "yyyy-MM-dd")
                        );
                        setWeekPickerOpen(true);
                      }}
                    >
                      {t("analytics.selectWeek", currentLocale)}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setWeekBaseDate((prev) => addWeeks(prev, 1))}
                    >
                      →
                    </Button>
                    <div className="text-xs md:text-sm text-muted-foreground min-w-[160px] text-right">
                      {data.period.weekFrom} - {data.period.weekTo}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm font-medium">
                    {t("analytics.monthlyTotalHours", currentLocale)}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setMonthBaseDate((prev) => subMonths(prev, 1))}
                    >
                      ←
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPendingMonthValue(format(startOfMonth(monthBaseDate), "yyyy-MM"));
                        setMonthPickerOpen(true);
                      }}
                    >
                      {t("analytics.selectMonth", currentLocale)}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setMonthBaseDate((prev) => addMonths(prev, 1))}
                    >
                      →
                    </Button>
                    <div className="text-xs md:text-sm text-muted-foreground min-w-[160px] text-right">
                      {data.period.monthFrom} - {data.period.monthTo}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base md:text-lg">
                    {t("analytics.weeklyTotalHours", currentLocale)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {data.summary.weeklyTotalHours.toFixed(1)}h
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {data.period.weekFrom} - {data.period.weekTo}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base md:text-lg">
                    {t("analytics.monthlyTotalHours", currentLocale)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {data.summary.monthlyTotalHours.toFixed(1)}h
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {data.period.monthFrom} - {data.period.monthTo}
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base md:text-lg">
                    {t("analytics.weeklyByUser", currentLocale)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {data.weeklyByUser.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {t("analytics.noData", currentLocale)}
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2">{t("analytics.user", currentLocale)}</th>
                            <th className="text-right py-2">{t("analytics.hours", currentLocale)}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.weeklyByUser.map((item) => (
                            <tr key={`weekly-${item.userId}`} className="border-b last:border-0">
                              <td className="py-2">{item.userName}</td>
                              <td className="py-2 text-right">{item.hours.toFixed(1)}h</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base md:text-lg">
                    {t("analytics.monthlyByUser", currentLocale)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {data.monthlyByUser.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {t("analytics.noData", currentLocale)}
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2">{t("analytics.user", currentLocale)}</th>
                            <th className="text-right py-2">{t("analytics.hours", currentLocale)}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.monthlyByUser.map((item) => (
                            <tr key={`monthly-${item.userId}`} className="border-b last:border-0">
                              <td className="py-2">{item.userName}</td>
                              <td className="py-2 text-right">{item.hours.toFixed(1)}h</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>

      <Dialog open={weekPickerOpen} onOpenChange={setWeekPickerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("analytics.chooseWeek", currentLocale)}</DialogTitle>
          </DialogHeader>
          <Select value={pendingWeekValue} onValueChange={setPendingWeekValue}>
            <SelectTrigger>
              <SelectValue placeholder={t("analytics.selectWeek", currentLocale)} />
            </SelectTrigger>
            <SelectContent>
              {weekOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWeekPickerOpen(false)}>
              {t("common.cancel", currentLocale)}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const currentWeekStart = format(
                  startOfWeek(new Date(), { weekStartsOn: 1 }),
                  "yyyy-MM-dd"
                );
                setPendingWeekValue(currentWeekStart);
                setWeekBaseDate(new Date());
                setWeekPickerOpen(false);
              }}
            >
              {t("schedule.currentWeek", currentLocale)}
            </Button>
            <Button
              onClick={() => {
                const [year, month, day] = pendingWeekValue.split("-").map(Number);
                setWeekBaseDate(new Date(year, month - 1, day));
                setWeekPickerOpen(false);
              }}
            >
              {t("common.confirm", currentLocale)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={monthPickerOpen} onOpenChange={setMonthPickerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("analytics.chooseMonth", currentLocale)}</DialogTitle>
          </DialogHeader>
          <Select value={pendingMonthValue} onValueChange={setPendingMonthValue}>
            <SelectTrigger>
              <SelectValue placeholder={t("analytics.selectMonth", currentLocale)} />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMonthPickerOpen(false)}>
              {t("common.cancel", currentLocale)}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const currentMonthStart = format(startOfMonth(new Date()), "yyyy-MM");
                setPendingMonthValue(currentMonthStart);
                setMonthBaseDate(new Date());
                setMonthPickerOpen(false);
              }}
            >
              {t("availability.currentMonth", currentLocale)}
            </Button>
            <Button
              onClick={() => {
                const [year, month] = pendingMonthValue.split("-").map(Number);
                setMonthBaseDate(new Date(year, month - 1, 1));
                setMonthPickerOpen(false);
              }}
            >
              {t("common.confirm", currentLocale)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
