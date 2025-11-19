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
  const [selectedUserId, setSelectedUserId] = useState<string>(userId || "current"); // 관리자가 선택한 유저 (등록용)
  const [selectedRemoveUserId, setSelectedRemoveUserId] = useState<string>(""); // 해제할 유저 ID
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
    const targetUserId = canManage && selectedUserId !== "current" ? selectedUserId : (userId || "current");
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
      // 관리자인 경우: 액션 선택 모달 표시
      const dateAvailabilities = getAvailabilitiesForDate(date);
      if (dateAvailabilities.length > 0) {
        // unavailable이 있는 경우: 액션 선택 모달
        if (dateAvailabilities.length === 1) {
          // 단일 유저인 경우 자동 선택
          setSelectedRemoveUserId(dateAvailabilities[0].userId);
        } else {
          // 복수 유저인 경우 선택 필요
          setSelectedRemoveUserId("");
        }
      }
      setActionDialogOpen(true);
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
      setDialogOpen(true);
    } else {
      // 해제 모달
      setDialogOpen(true);
    }
  };

  // 출근 불가 등록 확인
  const handleConfirmUnavailable = async () => {
    if (!selectedDate) return;

    const date = new Date(selectedDate);
    const dateStr = date.toISOString().split("T")[0];
    const targetUserId = canManage && selectedUserId !== "current" ? selectedUserId : (userId || "current");

    try {
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
          description: toMessage(
            result.error || "Failed to mark as available"
          ),
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
                const dateAvailabilities = canManage 
                  ? getAvailabilitiesForDate(date)
                  : getAvailabilityForDate(date) ? [getAvailabilityForDate(date)!] : [];
                const isUnavailable = dateAvailabilities.length > 0;
                const isCurrentDay = isToday(date);
                const isPastDay = isPast(date) && !isToday(date);
                const unavailableCount = dateAvailabilities.length;

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
                        <div className="mt-1 flex flex-col items-center gap-0.5">
                          <AlertCircle className="h-3 w-3 text-red-500" />
                          {canManage && unavailableCount > 1 && (
                            <Badge variant="destructive" className="h-4 px-1 text-xs">
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
                              className="text-xs text-red-600 truncate w-full text-center px-0.5"
                              title={availability.userName || availability.userId}
                            >
                              {availability.userName || availability.userId}
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
                <Button variant="outline" onClick={() => setActionDialogOpen(false)}>
                  {t("common.cancel", locale)}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* 출근 불가 등록/해제 다이얼로그 */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {dialogMode === "add"
                  ? t("availability.markUnavailable", locale)
                  : t("availability.removeUnavailable", locale) || "출근 불가 해제"}
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
                      <Label htmlFor="user-select">{t("availability.selectUser", locale)}</Label>
                      <Select
                        value={selectedUserId}
                        onValueChange={setSelectedUserId}
                      >
                        <SelectTrigger id="user-select">
                          <SelectValue placeholder={t("availability.selectUser", locale)} />
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
                            <Label>{t("availability.user", locale) || "사용자"}</Label>
                            <Input
                              value={availability.userName || ""}
                              disabled
                            />
                          </div>
                          {availability.reason && (
                            <div>
                              <Label>{t("availability.reason", locale)}</Label>
                              <Input
                                value={availability.reason}
                                disabled
                              />
                            </div>
                          )}
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setDialogOpen(false)}>
                              {t("common.cancel", locale)}
                            </Button>
                            <Button variant="destructive" onClick={handleConfirmRemove}>
                              {t("availability.confirmRemove", locale) || "해제"}
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
                              {t("availability.selectUserToRemove", locale) || "해제할 사용자 선택"}
                            </Label>
                            <Select
                              value={selectedRemoveUserId}
                              onValueChange={setSelectedRemoveUserId}
                            >
                              <SelectTrigger id="remove-user-select">
                                <SelectValue placeholder={t("availability.selectUserToRemove", locale) || "사용자 선택"} />
                              </SelectTrigger>
                              <SelectContent>
                                {dateAvailabilities.map((availability) => (
                                  <SelectItem key={availability.userId} value={availability.userId}>
                                    {availability.userName || availability.userId}
                                    {availability.reason && ` - ${availability.reason}`}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setDialogOpen(false)}>
                              {t("common.cancel", locale)}
                            </Button>
                            <Button 
                              variant="destructive" 
                              onClick={handleConfirmRemove}
                              disabled={!selectedRemoveUserId}
                            >
                              {t("availability.confirmRemove", locale) || "해제"}
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
