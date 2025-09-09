"use client";

import { useState, useEffect } from "react";
import { Calendar, AlertCircle, CheckCircle, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { useToast } from "@/hooks/use-toast";
import { t, type Locale } from "@/lib/i18n";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isToday,
  isPast,
} from "date-fns";
import { ko, enUS, ja } from "date-fns/locale";

// 日付フォーマット용 로케일 매핑
const dateLocales = { ko, en: enUS, ja };

interface UserAvailability {
  id: string;
  storeId: string;
  userId: string;
  userName: string;
  date: string;
  reason?: string;
  createdAt: string;
  updatedAt: string;
}

interface UserAvailabilityCalendarProps {
  storeId: string;
  userId?: string; // undefined면 현재 사용자
  locale: Locale;
  canManage?: boolean; // 관리자 권한
  onAvailabilityChange?: (
    date: string,
    isUnavailable: boolean,
    reason?: string
  ) => void;
}

export function UserAvailabilityCalendar({
  storeId,
  userId,
  locale,
  canManage = false,
  onAvailabilityChange,
}: UserAvailabilityCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [availabilities, setAvailabilities] = useState<UserAvailability[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reason, setReason] = useState("");
  const { toast } = useToast();
  const toMessage = (v: unknown) =>
    typeof v === "string"
      ? v
      : (() => {
          try {
            return JSON.stringify(v);
          } catch {
            return String(v);
          }
        })();

  // 월의 날짜 범위 계산
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // 출근 불가 데이터 로드
  useEffect(() => {
    loadAvailabilities();
  }, [storeId, userId, currentMonth]);

  const loadAvailabilities = async () => {
    if (!storeId) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        store_id: storeId,
        from: monthStart.toISOString().split("T")[0],
        to: monthEnd.toISOString().split("T")[0],
      });

      if (userId) {
        params.append("user_id", userId);
      }

      const response = await fetch(`/api/schedule/availability?${params}`);
      const result = await response.json();

      if (result.success) {
        setAvailabilities(result.data || []);
      } else {
        toast({
          title: t("common.error", locale),
          description: toMessage(
            result.error || "Failed to load availability data"
          ),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("출근 불가 데이터 로드 오류:", error);
      toast({
        title: t("common.error", locale),
        description: toMessage(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // 특정 날짜의 출근 불가 상태 확인
  const getAvailabilityForDate = (date: Date): UserAvailability | null => {
    const dateStr = date.toISOString().split("T")[0];
    return availabilities.find((a) => a.date === dateStr) || null;
  };

  // 출근 불가 등록/해제
  const toggleAvailability = async (
    date: Date,
    isUnavailable: boolean,
    reason?: string
  ) => {
    if (!storeId) return;

    const dateStr = date.toISOString().split("T")[0];
    const targetUserId = userId || "current"; // API에서 현재 사용자 ID 처리
    console.log("Availability toggle:", {
      storeId,
      targetUserId,
      dateStr,
      isUnavailable,
      reason,
    });

    try {
      if (isUnavailable) {
        // 출근 불가 등록
        const response = await fetch("/api/schedule/availability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            store_id: storeId,
            user_id: targetUserId,
            date: dateStr,
            reason: reason || undefined,
          }),
        });

        const result = await response.json();
        if (result.success) {
          toast({
            title: t("availability.markUnavailable", locale),
            description: t("availability.success", locale),
          });
          loadAvailabilities();
          onAvailabilityChange?.(dateStr, true, reason);
        } else {
          toast({
            title: t("common.error", locale),
            description: toMessage(
              result.error || "Failed to mark as unavailable"
            ),
            variant: "destructive",
          });
        }
      } else {
        // 출근 불가 해제
        const params = new URLSearchParams({
          store_id: storeId,
          user_id: targetUserId,
          date: dateStr,
        });

        const response = await fetch(`/api/schedule/availability?${params}`, {
          method: "DELETE",
        });

        const result = await response.json();
        if (result.success) {
          toast({
            title: t("availability.markAvailable", locale),
            description: t("availability.success", locale),
          });
          loadAvailabilities();
          onAvailabilityChange?.(dateStr, false);
        } else {
          toast({
            title: t("common.error", locale),
            description: toMessage(
              result.error || "Failed to mark as available"
            ),
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error("출근 불가 상태 변경 오류:", error);
      toast({
        title: t("common.error", locale),
        description: toMessage(error),
        variant: "destructive",
      });
    }
  };

  // 날짜 클릭 핸들러
  const handleDateClick = (date: Date) => {
    if (isPast(date) && !isToday(date)) {
      toast({
        title: t("availability.pastDate", locale),
        description: t("availability.pastDateDescription", locale),
        variant: "destructive",
      });
      return;
    }

    const availability = getAvailabilityForDate(date);
    if (availability) {
      // 출근 불가 해제
      toggleAvailability(date, false);
    } else {
      // 출근 불가 등록
      setSelectedDate(date.toISOString().split("T")[0]);
      setReason("");
      setDialogOpen(true);
    }
  };

  // 출근 불가 등록 확인
  const handleConfirmUnavailable = () => {
    if (!selectedDate) return;

    const date = new Date(selectedDate);
    toggleAvailability(date, true, reason);
    setDialogOpen(false);
    setSelectedDate(null);
    setReason("");
  };

  // 월 이동
  const goToPreviousMonth = () => {
    setCurrentMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
    );
  };

  const goToNextMonth = () => {
    setCurrentMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
    );
  };

  const goToCurrentMonth = () => {
    setCurrentMonth(new Date());
  };

  // 날짜 포맷팅
  const formatDate = (date: Date): string => {
    const dateLocale = dateLocales[locale];
    return format(date, "d", { locale: dateLocale });
  };

  const formatMonthYear = (date: Date): string => {
    const dateLocale = dateLocales[locale];
    return format(date, "MMMM yyyy", { locale: dateLocale });
  };

  const formatWeekday = (date: Date): string => {
    const dateLocale = dateLocales[locale];
    return format(date, "EEE", { locale: dateLocale });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          {t("availability.title", locale)}
        </CardTitle>

        {/* 월 네비게이션 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToPreviousMonth}>
              ←
            </Button>
            <Button variant="outline" size="sm" onClick={goToCurrentMonth}>
              {t("availability.currentMonth", locale)}
            </Button>
            <Button variant="outline" size="sm" onClick={goToNextMonth}>
              →
            </Button>
          </div>

          <div className="text-lg font-semibold">
            {formatMonthYear(currentMonth)}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <Calendar className="h-8 w-8 animate-spin mx-auto mb-2" />
              <p className="text-muted-foreground">
                {t("common.loading", locale)}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 요일 헤더 */}
            <div className="grid grid-cols-7 gap-1">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                (day, index) => (
                  <div
                    key={index}
                    className="p-2 text-center text-sm font-medium text-muted-foreground"
                  >
                    {day}
                  </div>
                )
              )}
            </div>

            {/* 캘린더 그리드 */}
            <div className="grid grid-cols-7 gap-1">
              {monthDays.map((date, index) => {
                const availability = getAvailabilityForDate(date);
                const isUnavailable = availability !== null;
                const isCurrentDay = isToday(date);
                const isPastDay = isPast(date) && !isToday(date);

                return (
                  <div
                    key={index}
                    className={`
                      aspect-square p-2 border rounded-md cursor-pointer transition-colors
                      ${isCurrentDay ? "bg-primary/10 border-primary" : ""}
                      ${
                        isPastDay
                          ? "bg-muted/50 cursor-not-allowed opacity-50"
                          : "hover:bg-muted/50"
                      }
                      ${isUnavailable ? "bg-red-50 border-red-200" : ""}
                    `}
                    onClick={() => !isPastDay && handleDateClick(date)}
                  >
                    <div className="flex flex-col items-center justify-center h-full">
                      <div
                        className={`
                        text-sm font-medium
                        ${isCurrentDay ? "text-primary" : ""}
                        ${isUnavailable ? "text-red-600" : ""}
                      `}
                      >
                        {formatDate(date)}
                      </div>

                      {isUnavailable && (
                        <div className="mt-1">
                          <AlertCircle className="h-3 w-3 text-red-500" />
                        </div>
                      )}

                      {!isUnavailable && !isPastDay && (
                        <div className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Plus className="h-3 w-3 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 범례 */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-50 border border-red-200 rounded"></div>
                <span>{t("availability.unavailable", locale)}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-primary/10 border border-primary rounded"></div>
                <span>{t("availability.today", locale)}</span>
              </div>
            </div>
          </div>
        )}

        {/* 출근 불가 등록 다이얼로그 */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {t("availability.markUnavailable", locale)}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="date">{t("availability.date", locale)}</Label>
                <Input
                  id="date"
                  value={
                    selectedDate
                      ? new Date(selectedDate).toLocaleDateString()
                      : ""
                  }
                  disabled
                />
              </div>

              <div>
                <Label htmlFor="reason">
                  {t("availability.reason", locale)}
                </Label>
                <Textarea
                  id="reason"
                  placeholder={t("availability.reasonPlaceholder", locale)}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  {t("common.cancel", locale)}
                </Button>
                <Button onClick={handleConfirmUnavailable}>
                  {t("availability.confirmMarkUnavailable", locale)}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
