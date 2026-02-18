"use client";

import { useState, useEffect, useCallback } from "react";
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
import { DateActionSheet } from "@/components/schedule/date-action-sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
  startOfWeek,
  endOfWeek,
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
  hasTimeRestriction?: boolean;
  startTime?: string | null;
  endTime?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface StoreUser {
  id: string;
  name: string;
  email: string;
  roles: string[];
}

interface UserAvailabilityCalendarProps {
  storeId: string;
  userId?: string; // undefined면 현재 사용자
  locale: Locale;
  canManage?: boolean; // 관리자 권한
  storeUsers?: StoreUser[]; // 매장 사용자 목록 (관리자용)
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
  storeUsers = [],
  onAvailabilityChange,
}: UserAvailabilityCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [availabilities, setAvailabilities] = useState<UserAvailability[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionDialogOpen, setActionDialogOpen] = useState(false); // 액션 선택 모달 (등록/해제 선택)
  const [dialogMode, setDialogMode] = useState<"add" | "remove">("add"); // 모달 모드: 등록 또는 해제
  const [reason, setReason] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string>(
    userId || "current"
  ); // 관리자가 선택한 유저 (등록용)
  const [selectedRemoveUserId, setSelectedRemoveUserId] = useState<string>(""); // 해제할 유저 ID
  const [hasTimeRestriction, setHasTimeRestriction] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [timePeriod, setTimePeriod] = useState<"morning" | "afternoon">(
    "morning"
  );
  const [shiftBoundaryTimeMin, setShiftBoundaryTimeMin] = useState<number>(720); // 기본값: 12:00
  const [multiDateMode, setMultiDateMode] = useState(false); // 다중 날짜 모드
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set()); // 선택된 날짜들
  const [multiDateCalendarMonth, setMultiDateCalendarMonth] = useState(new Date()); // 다중 날짜 선택 캘린더 월
  const [businessHours, setBusinessHours] = useState<
    Array<{
      id: string;
      store_id: string;
      weekday: number;
      open_min: number;
      close_min: number;
    }>
  >([]);
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

  // 월의 날짜 범위 계산 (월요일 시작 주 포함)
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  // 월의 첫 주 시작일 (월요일)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  // 월의 마지막 주 종료일 (일요일)
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const monthDays = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd,
  });

  // 매장 정보 및 영업 시간 조회
  useEffect(() => {
    const fetchStoreData = async () => {
      if (!storeId) return;

      try {
        // 매장 정보 조회 (shift_boundary_time_min 포함)
        const storeResponse = await fetch(`/api/stores/${storeId}`);
        const storeData = await storeResponse.json();
        if (storeData.success && storeData.data) {
          setShiftBoundaryTimeMin(
            storeData.data.shift_boundary_time_min ?? 720
          );
        }

        // 영업 시간 조회
        const response = await fetch(
          `/api/store-business-hours?store_id=${storeId}`
        );
        const data = await response.json();

        if (data.success && data.data && data.data.length > 0) {
          setBusinessHours(data.data);
        } else {
          // 영업 시간이 없을 경우 기본값 설정
          const defaultHours = [
            {
              id: "",
              store_id: storeId,
              weekday: 0,
              open_min: 540,
              close_min: 1320,
            },
            {
              id: "",
              store_id: storeId,
              weekday: 1,
              open_min: 540,
              close_min: 1320,
            },
            {
              id: "",
              store_id: storeId,
              weekday: 2,
              open_min: 540,
              close_min: 1320,
            },
            {
              id: "",
              store_id: storeId,
              weekday: 3,
              open_min: 540,
              close_min: 1320,
            },
            {
              id: "",
              store_id: storeId,
              weekday: 4,
              open_min: 540,
              close_min: 1320,
            },
            {
              id: "",
              store_id: storeId,
              weekday: 5,
              open_min: 540,
              close_min: 1320,
            },
            {
              id: "",
              store_id: storeId,
              weekday: 6,
              open_min: 540,
              close_min: 1320,
            },
          ];
          setBusinessHours(defaultHours);
        }
      } catch (error) {
        console.error("매장 정보 조회 실패:", error);
      }
    };

    fetchStoreData();
  }, [storeId]);

  // 출근 불가 데이터 로드
  useEffect(() => {
    loadAvailabilities();
  }, [storeId, currentMonth, canManage, userId]);

  const loadAvailabilities = async () => {
    if (!storeId) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        store_id: storeId,
        from: monthStart.toISOString().split("T")[0],
        to: monthEnd.toISOString().split("T")[0],
      });

      // 관리자가 아닌 경우 또는 관리자지만 특정 유저를 선택한 경우만 user_id 필터 적용
      // 관리자이고 전체 조회인 경우 user_id 필터 없이 전체 데이터 로드
      if (!canManage) {
        const targetUserId = userId || undefined;
        if (targetUserId) {
          params.append("user_id", targetUserId);
        }
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

  // 특정 날짜의 출근 불가 상태 확인 (단일 유저)
  const getAvailabilityForDate = (date: Date): UserAvailability | null => {
    const dateStr = date.toISOString().split("T")[0];
    if (!canManage) {
      // 관리자가 아닌 경우: 현재 유저의 unavailable만 확인
      return availabilities.find((a) => a.date === dateStr) || null;
    }
    // 관리자인 경우: 첫 번째 unavailable 반환 (표시용)
    return availabilities.find((a) => a.date === dateStr) || null;
  };

  // 특정 날짜의 모든 출근 불가 상태 확인 (관리자용)
  const getAvailabilitiesForDate = (date: Date): UserAvailability[] => {
    const dateStr = date.toISOString().split("T")[0];
    return availabilities.filter((a) => a.date === dateStr);
  };

  // 출근 불가 등록/해제
  const toggleAvailability = async (
    date: Date,
    isUnavailable: boolean,
    reason?: string
  ) => {
    if (!storeId) return;

    const dateStr = date.toISOString().split("T")[0];
    // 관리자인 경우 선택한 유저 사용, 아니면 현재 유저 또는 userId 사용
    const targetUserId =
      canManage && selectedUserId !== "current"
        ? selectedUserId
        : userId || "current";
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

    const dateStr = date.toISOString().split("T")[0];
    setSelectedDate(dateStr);

    if (canManage) {
      // 관리자인 경우
      const dateAvailabilities = getAvailabilitiesForDate(date);
      if (dateAvailabilities.length > 0) {
        // unavailable이 있는 경우: 액션 선택 모달 표시
        if (dateAvailabilities.length === 1) {
          // 단일 유저인 경우 자동 선택
          setSelectedRemoveUserId(dateAvailabilities[0].userId);
        } else {
          // 복수 유저인 경우 선택 필요
          setSelectedRemoveUserId("");
        }
        setActionDialogOpen(true);
      } else {
        // unavailable이 없는 경우: 바로 등록 모달 표시
        setSelectedUserId(userId || "current");
        setReason("");
        setDialogMode("add");
        setDialogOpen(true);
      }
    } else {
      // 일반 사용자인 경우: 기존 로직
      const availability = getAvailabilityForDate(date);
      if (availability) {
        // 출근 불가 해제
        toggleAvailability(date, false);
      } else {
        // 출근 불가 등록
        setReason("");
        setDialogMode("add");
        setDialogOpen(true);
      }
    }
  };

  // 액션 선택 핸들러 (등록 또는 해제)
  const handleActionSelect = (action: "add" | "remove") => {
    setActionDialogOpen(false);
    setDialogMode(action);

    if (action === "add") {
      // 등록 모달
      setSelectedUserId(userId || "current");
      setReason("");
      setHasTimeRestriction(false);
      setStartTime("");
      setEndTime("");
      setTimePeriod("morning");
      setDialogOpen(true);
    } else {
      // 해제 모달
      setDialogOpen(true);
    }
  };

  // 분을 시간:분 형식으로 변환
  const formatTimeFromMinutes = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}`;
  };

  // 시간 포맷팅 (HH:mm 형식)
  const formatTime = (time: string): string => {
    return time.substring(0, 5); // HH:mm 형식으로 변환
  };

  // 시간 자동 설정 함수
  const updateTimeFromPeriod = useCallback(() => {
    if (!hasTimeRestriction || !timePeriod || !selectedDate) return;

    const selectedDateObj = new Date(selectedDate);
    const dayOfWeek = selectedDateObj.getDay();

    // 해당 요일의 영업 시간 찾기
    const dayBusinessHour = businessHours.find((h) => h.weekday === dayOfWeek);

    if (dayBusinessHour && businessHours.length > 0) {
      const openMin = dayBusinessHour.open_min;
      const closeMin =
        dayBusinessHour.close_min === 0 ? 1440 : dayBusinessHour.close_min;
      const boundaryMin = shiftBoundaryTimeMin;

      if (timePeriod === "morning") {
        // 오전: 영업 시작 시간 ~ 오전/오후 경계 시간
        const morningStart = Math.max(openMin, 0);
        const morningEnd = Math.min(boundaryMin, closeMin);
        setStartTime(formatTimeFromMinutes(morningStart));
        setEndTime(formatTimeFromMinutes(morningEnd));
      } else {
        // 오후: 오전/오후 경계 시간 ~ 영업 종료 시간
        const afternoonStart = Math.max(boundaryMin, openMin);
        let afternoonEnd = Math.min(closeMin, 1440);

        // 시작 시간이 종료 시간보다 크거나 같으면 종료 시간을 조정
        if (afternoonStart >= afternoonEnd) {
          // 경계 시간이 영업 종료 시간보다 크거나 같으면 영업 종료 시간 사용
          afternoonEnd = closeMin;
        }

        // 최소한 경계 시간 이후로 설정
        if (afternoonEnd <= afternoonStart) {
          afternoonEnd = Math.min(afternoonStart + 60, 1440); // 최소 1시간
        }

        setStartTime(formatTimeFromMinutes(afternoonStart));
        setEndTime(formatTimeFromMinutes(afternoonEnd));
      }
    } else {
      // 영업 시간이 없는 경우 기본값 사용
      if (timePeriod === "morning") {
        setStartTime("09:00");
        setEndTime(formatTimeFromMinutes(shiftBoundaryTimeMin));
      } else {
        setStartTime(formatTimeFromMinutes(shiftBoundaryTimeMin));
        setEndTime("18:00");
      }
    }
  }, [
    hasTimeRestriction,
    timePeriod,
    selectedDate,
    businessHours,
    shiftBoundaryTimeMin,
  ]);

  // 오전/오후 토글 시 시간 자동 입력 (매장 설정 기반)
  useEffect(() => {
    updateTimeFromPeriod();
  }, [updateTimeFromPeriod]);

  // 출근 불가 등록 확인
  const handleConfirmUnavailable = async () => {
    if (!selectedDate) return;

    const targetUserId =
      canManage && selectedUserId !== "current"
        ? selectedUserId
        : userId || "current";

    // 다중 날짜 모드인 경우 선택된 모든 날짜 처리
    const datesToProcess = multiDateMode && selectedDates.size > 0
      ? Array.from(selectedDates)
      : [selectedDate];

    let successCount = 0;
    let failCount = 0;

    try {
      // 각 날짜에 대해 순차적으로 등록
      for (const dateStr of datesToProcess) {
        const requestBody: any = {
          store_id: storeId,
          user_id: targetUserId,
          date: dateStr,
          reason: reason || undefined,
        };

        if (hasTimeRestriction) {
          requestBody.has_time_restriction = true;
          requestBody.start_time = startTime;
          requestBody.end_time = endTime;
        }

        const response = await fetch("/api/schedule/availability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });

        const result = await response.json();
        if (result.success) {
          successCount++;
          onAvailabilityChange?.(dateStr, true, reason);
        } else {
          failCount++;
        }
      }

      if (successCount > 0) {
        toast({
          title: t("availability.markUnavailable", locale),
          description: 
            datesToProcess.length > 1
              ? `${successCount}개의 날짜가 등록되었습니다.${failCount > 0 ? ` (${failCount}개 실패)` : ""}`
              : t("availability.success", locale),
        });
        loadAvailabilities();
      } else {
        toast({
          title: t("common.error", locale),
          description: "모든 날짜 등록에 실패했습니다.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("출근 불가 등록 오류:", error);
      toast({
        title: t("common.error", locale),
        description: toMessage(error),
        variant: "destructive",
      });
    }

    setDialogOpen(false);
    setSelectedDate(null);
    setReason("");
    setHasTimeRestriction(false);
    setStartTime("");
    setEndTime("");
    setTimePeriod("morning");
    setMultiDateMode(false);
    setSelectedDates(new Set());
  };

  // 출근 불가 해제 확인
  const handleConfirmRemove = async () => {
    if (!selectedDate || !selectedRemoveUserId) return;

    const date = new Date(selectedDate);
    const dateStr = date.toISOString().split("T")[0];

    try {
      const params = new URLSearchParams({
        store_id: storeId,
        user_id: selectedRemoveUserId,
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
          description: toMessage(result.error || "Failed to mark as available"),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("출근 불가 해제 오류:", error);
      toast({
        title: t("common.error", locale),
        description: toMessage(error),
        variant: "destructive",
      });
    }

    setDialogOpen(false);
    setSelectedDate(null);
    setSelectedRemoveUserId("");
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
        <div className="flex items-center justify-between mt-4">
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
          <div className="space-y-2 md:space-y-4">
            {/* 요일 헤더 */}
            <div className="grid grid-cols-7 gap-1 md:gap-2">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                (day, index) => (
                  <div
                    key={index}
                    className="p-1 md:p-2 text-center text-xs md:text-sm font-medium text-muted-foreground"
                  >
                    {day}
                  </div>
                )
              )}
            </div>

            {/* 캘린더 그리드 */}
            <div className="grid grid-cols-7 gap-1 md:gap-2">
              {monthDays.map((date, index) => {
                // 현재 월에 속하는 날짜인지 확인
                const isCurrentMonth =
                  date.getMonth() === currentMonth.getMonth();
                const dateAvailabilities = canManage
                  ? getAvailabilitiesForDate(date)
                  : getAvailabilityForDate(date)
                  ? [getAvailabilityForDate(date)!]
                  : [];
                const isUnavailable = dateAvailabilities.length > 0;
                const isCurrentDay = isToday(date);
                const isPastDay = isPast(date) && !isToday(date);
                const unavailableCount = dateAvailabilities.length;

                return (
                  <div
                    key={index}
                    className={`
                      aspect-square p-1 md:p-2 border rounded-md transition-colors touch-manipulation
                      ${!isCurrentMonth ? "opacity-30" : ""}
                      ${isCurrentDay ? "bg-primary/10 border-primary" : ""}
                      ${
                        isPastDay || !isCurrentMonth
                          ? "bg-muted/50 cursor-not-allowed opacity-50"
                          : "hover:bg-muted/50 cursor-pointer"
                      }
                      ${
                        isUnavailable && isCurrentMonth
                          ? "bg-red-50 border-red-200"
                          : ""
                      }
                    `}
                    onClick={() =>
                      !isPastDay && isCurrentMonth && handleDateClick(date)
                    }
                  >
                    <div className="flex flex-col items-center justify-center h-full">
                      <div
                        className={`
                        text-xs md:text-sm font-medium
                        ${isCurrentDay ? "text-primary" : ""}
                        ${isUnavailable ? "text-red-600" : ""}
                      `}
                      >
                        {formatDate(date)}
                      </div>

                      {isUnavailable && (
                        <div className="mt-0.5 md:mt-1 flex flex-col items-center gap-0.5">
                          <AlertCircle className="h-2.5 w-2.5 md:h-3 md:w-3 text-red-500" />
                          {canManage && unavailableCount > 1 && (
                            <Badge
                              variant="destructive"
                              className="h-3 md:h-4 px-0.5 md:px-1 text-[10px] md:text-xs"
                            >
                              {unavailableCount}
                            </Badge>
                          )}
                        </div>
                      )}

                      {canManage && isUnavailable && (
                        <div className="mt-0.5 flex flex-col items-center gap-0.5 w-full">
                          {dateAvailabilities.map((availability, idx) => (
                            <div
                              key={availability.userId}
                              className="flex items-center gap-1 text-xs text-red-600 truncate w-full text-center px-0.5"
                              title={
                                availability.userName || availability.userId
                              }
                            >
                              {dateAvailabilities.length > 1 && (
                                <Badge
                                  variant="destructive"
                                  className="h-3 px-1 text-xs min-w-[12px] flex items-center justify-center"
                                >
                                  {idx + 1}
                                </Badge>
                              )}
                              <span className="truncate">
                                {availability.userName || availability.userId}
                              </span>
                              {availability.hasTimeRestriction &&
                                availability.startTime &&
                                availability.endTime && (
                                  <span className="text-xs opacity-75 truncate">
                                    ({formatTime(availability.startTime)}-
                                    {formatTime(availability.endTime)})
                                  </span>
                                )}
                            </div>
                          ))}
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

        {/* 액션 선택 다이얼로그 (관리자용) */}
        <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {t("availability.selectAction", locale) || "액션 선택"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label>{t("availability.date", locale)}</Label>
                <Input
                  value={
                    selectedDate
                      ? new Date(selectedDate).toLocaleDateString()
                      : ""
                  }
                  disabled
                />
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  variant="default"
                  onClick={() => handleActionSelect("add")}
                  className="w-full"
                >
                  {t("availability.markUnavailable", locale)}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleActionSelect("remove")}
                  className="w-full"
                >
                  {t("availability.removeUnavailable", locale)}
                </Button>
              </div>

              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => setActionDialogOpen(false)}
                >
                  {t("common.cancel", locale)}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* 출근 불가 등록/해제 다이얼로그 */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {dialogMode === "add"
                  ? t("availability.markUnavailable", locale)
                  : t("availability.removeUnavailable", locale) ||
                    "출근 불가 해제"}
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

              {dialogMode === "add" ? (
                <>
                  {/* 등록 모달 */}
                  {canManage && storeUsers.length > 0 && (
                    <div>
                      <Label htmlFor="user-select">
                        {t("availability.selectUser", locale)}
                      </Label>
                      <Select
                        value={selectedUserId}
                        onValueChange={setSelectedUserId}
                      >
                        <SelectTrigger id="user-select">
                          <SelectValue
                            placeholder={t("availability.selectUser", locale)}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="current">
                            {t("availability.currentUser", locale)}
                          </SelectItem>
                          {storeUsers.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.name || user.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* 다중 날짜 모드 체크박스 */}
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="multi-date-mode"
                      checked={multiDateMode}
                      onCheckedChange={(checked) => {
                        setMultiDateMode(checked === true);
                        if (checked === true && selectedDate) {
                          // 초기 선택 날짜를 selectedDates에 추가
                          setSelectedDates(new Set([selectedDate]));
                          setMultiDateCalendarMonth(new Date(selectedDate));
                        } else {
                          setSelectedDates(new Set());
                        }
                      }}
                    />
                    <Label
                      htmlFor="multi-date-mode"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {t("availability.multiDateMode", locale)}
                    </Label>
                  </div>

                  {/* 다중 날짜 선택 캘린더 */}
                  {multiDateMode && (
                    <div className="space-y-4 p-4 border rounded-md bg-muted/50">
                      <div className="flex items-center justify-between">
                        <Label>
                          {t("availability.selectAdditionalDates", locale)}
                        </Label>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setMultiDateCalendarMonth(
                                (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                              );
                            }}
                          >
                            ←
                          </Button>
                          <span className="text-sm font-medium min-w-[120px] text-center">
                            {formatMonthYear(multiDateCalendarMonth)}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setMultiDateCalendarMonth(
                                (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                              );
                            }}
                          >
                            →
                          </Button>
                        </div>
                      </div>

                      {/* 다중 날짜 선택 캘린더 그리드 */}
                      <div className="space-y-2">
                        {/* 요일 헤더 */}
                        <div className="grid grid-cols-7 gap-1">
                          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                            (day, index) => (
                              <div
                                key={index}
                                className="p-1 text-center text-xs font-medium text-muted-foreground"
                              >
                                {day}
                              </div>
                            )
                          )}
                        </div>

                        {/* 캘린더 날짜들 */}
                        {(() => {
                          const multiMonthStart = startOfMonth(multiDateCalendarMonth);
                          const multiMonthEnd = endOfMonth(multiDateCalendarMonth);
                          const multiCalendarStart = startOfWeek(multiMonthStart, { weekStartsOn: 1 });
                          const multiCalendarEnd = endOfWeek(multiMonthEnd, { weekStartsOn: 1 });
                          const multiMonthDays = eachDayOfInterval({
                            start: multiCalendarStart,
                            end: multiCalendarEnd,
                          });

                          return (
                            <div className="grid grid-cols-7 gap-1">
                              {multiMonthDays.map((date, index) => {
                                const dateStr = date.toISOString().split("T")[0];
                                const isCurrentMonth = date.getMonth() === multiDateCalendarMonth.getMonth();
                                const isSelected = selectedDates.has(dateStr);
                                const isPastDay = isPast(date) && !isToday(date);
                                
                                // 해당 날짜가 이미 Unavailable인지 확인
                                const targetUserIdForCheck =
                                  canManage && selectedUserId !== "current"
                                    ? selectedUserId
                                    : userId || "current";
                                const isAlreadyUnavailable = availabilities.some(
                                  (a) => a.date === dateStr && 
                                    (targetUserIdForCheck === "current" 
                                      ? a.userId === userId 
                                      : a.userId === targetUserIdForCheck)
                                );

                                return (
                                  <div
                                    key={index}
                                    className={`
                                      aspect-square p-1 border rounded text-xs transition-colors
                                      ${!isCurrentMonth ? "opacity-30" : ""}
                                      ${isPastDay || !isCurrentMonth || isAlreadyUnavailable
                                        ? "bg-muted/50 cursor-not-allowed opacity-50"
                                        : "hover:bg-muted/50 cursor-pointer"
                                      }
                                      ${isSelected && isCurrentMonth && !isPastDay && !isAlreadyUnavailable
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : ""
                                      }
                                    `}
                                    onClick={() => {
                                      if (isPastDay || !isCurrentMonth || isAlreadyUnavailable) return;
                                      
                                      const newSelectedDates = new Set(selectedDates);
                                      if (isSelected) {
                                        newSelectedDates.delete(dateStr);
                                      } else {
                                        newSelectedDates.add(dateStr);
                                      }
                                      setSelectedDates(newSelectedDates);
                                    }}
                                  >
                                    <div className="flex items-center justify-center h-full">
                                      {formatDate(date)}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>

                      {/* 선택된 날짜 목록 */}
                      {selectedDates.size > 0 && (
                        <div className="space-y-2">
                          <Label className="text-sm">
                            {t("availability.selectedDates", locale)} ({selectedDates.size})
                          </Label>
                          <div className="flex flex-wrap gap-2">
                            {Array.from(selectedDates)
                              .sort()
                              .map((dateStr) => (
                                <Badge
                                  key={dateStr}
                                  variant="secondary"
                                  className="cursor-pointer"
                                  onClick={() => {
                                    const newSelectedDates = new Set(selectedDates);
                                    newSelectedDates.delete(dateStr);
                                    setSelectedDates(newSelectedDates);
                                  }}
                                >
                                  {new Date(dateStr).toLocaleDateString()}
                                  <X className="h-3 w-3 ml-1" />
                                </Badge>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

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

                  {/* 시간 제한 체크박스 */}
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="has-time-restriction"
                      checked={hasTimeRestriction}
                      onCheckedChange={(checked) => {
                        setHasTimeRestriction(checked === true);
                        if (checked === false) {
                          setStartTime("");
                          setEndTime("");
                        } else {
                          // 체크 시 시간 자동 설정
                          setTimeout(() => {
                            updateTimeFromPeriod();
                          }, 0);
                        }
                      }}
                    />
                    <Label
                      htmlFor="has-time-restriction"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {t("availability.hasTimeRestriction", locale) ||
                        "시간 제한"}
                    </Label>
                  </div>

                  {/* 시간 입력란 (시간 제한이 체크된 경우에만 표시) */}
                  {hasTimeRestriction && (
                    <div className="space-y-4 p-4 border rounded-md bg-muted/50">
                      {/* 오전/오후 토글 */}
                      <div className="flex items-center justify-between">
                        <Label>
                          {t("availability.timePeriod", locale) || "시간대"}
                        </Label>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant={
                              timePeriod === "morning" ? "default" : "outline"
                            }
                            size="sm"
                            onClick={() => setTimePeriod("morning")}
                          >
                            {t("schedule.morning", locale) || "오전"}
                          </Button>
                          <Button
                            type="button"
                            variant={
                              timePeriod === "afternoon" ? "default" : "outline"
                            }
                            size="sm"
                            onClick={() => setTimePeriod("afternoon")}
                          >
                            {t("schedule.afternoon", locale) || "오후"}
                          </Button>
                        </div>
                      </div>

                      {/* 시작 시간 */}
                      <div>
                        <Label htmlFor="start-time">
                          {t("availability.startTime", locale) || "시작 시간"}
                        </Label>
                        <Input
                          id="start-time"
                          type="time"
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                        />
                      </div>

                      {/* 종료 시간 */}
                      <div>
                        <Label htmlFor="end-time">
                          {t("availability.endTime", locale) || "종료 시간"}
                        </Label>
                        <Input
                          id="end-time"
                          type="time"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setDialogOpen(false)}
                    >
                      {t("common.cancel", locale)}
                    </Button>
                    <Button onClick={handleConfirmUnavailable}>
                      {t("availability.confirmMarkUnavailable", locale)}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  {/* 해제 모달 */}
                  {(() => {
                    const dateAvailabilities = selectedDate
                      ? getAvailabilitiesForDate(new Date(selectedDate))
                      : [];

                    if (dateAvailabilities.length === 0) {
                      return null;
                    }

                    if (dateAvailabilities.length === 1) {
                      // 단일 유저인 경우
                      const availability = dateAvailabilities[0];
                      return (
                        <>
                          <div>
                            <Label>
                              {t("availability.user", locale) || "사용자"}
                            </Label>
                            <Input
                              value={availability.userName || ""}
                              disabled
                            />
                          </div>
                          {availability.reason && (
                            <div>
                              <Label>{t("availability.reason", locale)}</Label>
                              <Input value={availability.reason} disabled />
                            </div>
                          )}
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              onClick={() => setDialogOpen(false)}
                            >
                              {t("common.cancel", locale)}
                            </Button>
                            <Button
                              variant="destructive"
                              onClick={handleConfirmRemove}
                            >
                              {t("availability.confirmRemove", locale) ||
                                "해제"}
                            </Button>
                          </div>
                        </>
                      );
                    } else {
                      // 복수 유저인 경우
                      return (
                        <>
                          <div>
                            <Label htmlFor="remove-user-select">
                              {t("availability.selectUserToRemove", locale) ||
                                "해제할 사용자 선택"}
                            </Label>
                            <Select
                              value={selectedRemoveUserId}
                              onValueChange={setSelectedRemoveUserId}
                            >
                              <SelectTrigger id="remove-user-select">
                                <SelectValue
                                  placeholder={
                                    t(
                                      "availability.selectUserToRemove",
                                      locale
                                    ) || "사용자 선택"
                                  }
                                />
                              </SelectTrigger>
                              <SelectContent>
                                {dateAvailabilities.map((availability) => (
                                  <SelectItem
                                    key={availability.userId}
                                    value={availability.userId}
                                  >
                                    {availability.userName ||
                                      availability.userId}
                                    {availability.reason &&
                                      ` - ${availability.reason}`}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              onClick={() => setDialogOpen(false)}
                            >
                              {t("common.cancel", locale)}
                            </Button>
                            <Button
                              variant="destructive"
                              onClick={handleConfirmRemove}
                              disabled={!selectedRemoveUserId}
                            >
                              {t("availability.confirmRemove", locale) ||
                                "해제"}
                            </Button>
                          </div>
                        </>
                      );
                    }
                  })()}
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
