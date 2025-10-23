"use client";

import { useState, useEffect } from "react";
import { Calendar, Clock, Users, AlertCircle, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { RoleBadge } from "@/components/auth/role-badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { t, type Locale } from "@/lib/i18n";
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  addMinutes,
  setHours,
  setMinutes,
} from "date-fns";
import { ko, enUS, ja } from "date-fns/locale";

// 日付フォーマット용 로케일 매핑
const dateLocales = { ko, en: enUS, ja };

interface ScheduleAssignment {
  id: string;
  storeId: string;
  userId: string;
  userName: string;
  workItemId: string;
  workItemName: string;
  date: string;
  startTime: string;
  endTime: string;
  status: "ASSIGNED" | "CONFIRMED" | "CANCELLED";
  notes?: string;
  requiredRoles: string[];
  userRoles: string[];
}

interface UserAvailability {
  id: string;
  storeId: string;
  userId: string;
  userName: string;
  date: string;
  reason?: string;
}

interface BusinessHour {
  id: string;
  store_id: string;
  weekday: number;
  open_min: number;
  close_min: number;
}

interface TimeSlot {
  startTime: string;
  endTime: string;
  startMin: number;
  endMin: number;
}

interface WeekGridProps {
  storeId: string;
  currentWeek: Date;
  locale: Locale;
  assignments: ScheduleAssignment[];
  userAvailabilities: UserAvailability[];
  storeUsers?: Array<{
    id: string;
    name: string;
    email: string;
    roles: string[];
  }>;
  onAssignmentClick?: (assignment: ScheduleAssignment) => void;
  onUserClick?: (userId: string, date: string) => void;
  onAvailabilityToggle?: (
    userId: string,
    date: string,
    isUnavailable: boolean
  ) => void;
  canManage?: boolean;
}

export function WeekGrid({
  storeId,
  currentWeek,
  locale,
  assignments,
  userAvailabilities,
  storeUsers = [],
  onAssignmentClick,
  onUserClick,
  onAvailabilityToggle,
  canManage = false,
}: WeekGridProps) {
  const [loading, setLoading] = useState(false);
  const [businessHours, setBusinessHours] = useState<BusinessHour[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [selectedCell, setSelectedCell] = useState<{
    userId: string;
    date: string;
    timeSlot: string;
  } | null>(null);

  // 週の日付 범위 계산
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }); // 월요일 시작
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // 매장 영업 시간 조회
  useEffect(() => {
    const fetchBusinessHours = async () => {
      try {
        setLoading(true);
        console.log("영업 시간 조회 시작, storeId:", storeId);

        const response = await fetch(
          `/api/store-business-hours?store_id=${storeId}`
        );
        const data = await response.json();

        console.log("영업 시간 조회 결과:", data);
        console.log("data.success:", data.success);
        console.log("data.data:", data.data);
        console.log("data.data.length:", data.data?.length);

        if (data.success && data.data && data.data.length > 0) {
          console.log("✅ 영업 시간 데이터 있음, 시간 슬롯 생성 시작");
          const slots = generateTimeSlots(data.data);
          setBusinessHours(data.data);
          setTimeSlots(slots);
        } else {
          // 영업 시간이 없을 경우 기본값 설정 (09:00 ~ 22:00)
          console.log("⚠️ 영업 시간이 없어서 기본값 사용");
          const defaultHours: BusinessHour[] = [
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
          const slots = generateTimeSlots(defaultHours);
          setBusinessHours(defaultHours);
          setTimeSlots(slots);
        }
      } catch (error) {
        console.error("❌ 영업 시간 조회 실패:", error);
      } finally {
        setLoading(false);
      }
    };

    if (storeId) {
      fetchBusinessHours();
    }
  }, [storeId]);

  // 시간 슬롯 생성 함수
  const generateTimeSlots = (hours: BusinessHour[]): TimeSlot[] => {
    console.log("시간 슬롯 생성 시작, hours:", hours);

    if (hours.length === 0) {
      console.log("영업 시간 데이터가 없습니다");
      return [];
    }

    // 모든 영업 시간에서 가장 이른 시작 시간과 가장 늦은 종료 시간 찾기
    // close_min이 0인 경우 자정(1440분)으로 처리
    const allOpenMins = hours.map((h) => h.open_min);
    const allCloseMins = hours.map((h) =>
      h.close_min === 0 ? 1440 : h.close_min
    );
    const earliestOpen = Math.min(...allOpenMins);
    const latestClose = Math.max(...allCloseMins);

    console.log(`시간 범위: ${earliestOpen}분 ~ ${latestClose}분`);

    // 30분 단위로 시간 슬롯 생성
    const slots: TimeSlot[] = [];
    for (let min = earliestOpen; min < latestClose; min += 30) {
      const startHour = Math.floor(min / 60);
      const startMinute = min % 60;
      const endMin = min + 30;
      const endHour = Math.floor(endMin / 60);
      const endMinute = endMin % 60;

      slots.push({
        startTime: `${startHour.toString().padStart(2, "0")}:${startMinute
          .toString()
          .padStart(2, "0")}`,
        endTime: `${endHour.toString().padStart(2, "0")}:${endMinute
          .toString()
          .padStart(2, "0")}`,
        startMin: min,
        endMin: endMin,
      });
    }

    console.log(`생성된 시간 슬롯 수: ${slots.length}`, slots.slice(0, 3));
    return slots;
  };

  // 사용자 목록 추출 (매장 사용자 우선, 배정/출근불가 사용자 추가)
  const allUserIds = new Set([
    ...storeUsers.map((u) => u.id),
    ...assignments.map((a) => a.userId),
    ...userAvailabilities.map((a) => a.userId),
  ]);

  const users = Array.from(allUserIds).map((userId) => {
    // 매장 사용자 정보 우선 사용
    const storeUser = storeUsers.find((u) => u.id === userId);
    if (storeUser) {
      return {
        id: userId,
        name: storeUser.name,
        roles: storeUser.roles,
      };
    }

    // 배정/출근불가에서 사용자 정보 추출
    const assignment = assignments.find((a) => a.userId === userId);
    const availability = userAvailabilities.find((a) => a.userId === userId);
    return {
      id: userId,
      name: assignment?.userName || availability?.userName || "Unknown User",
      roles: assignment?.userRoles || [],
    };
  });

  // 특정 사용자의 특정 날짜/시간 슬롯 배정 조회
  const getAssignmentsForUserDateTime = (
    userId: string,
    date: string,
    timeSlot: TimeSlot
  ): ScheduleAssignment[] => {
    return assignments.filter((a) => {
      if (a.userId !== userId || !isSameDay(new Date(a.date), new Date(date))) {
        return false;
      }

      // 시간 슬롯과 배정 시간이 겹치는지 확인
      const assignmentStartMin = timeStringToMinutes(a.startTime);
      const assignmentEndMin = timeStringToMinutes(a.endTime);

      return (
        assignmentStartMin < timeSlot.endMin &&
        assignmentEndMin > timeSlot.startMin
      );
    });
  };

  // 특정 사용자의 특정 날짜 출근 불가 상태 조회
  const getAvailabilityForUserDate = (
    userId: string,
    date: string
  ): UserAvailability | null => {
    return (
      userAvailabilities.find(
        (a) =>
          a.userId === userId && isSameDay(new Date(a.date), new Date(date))
      ) || null
    );
  };

  // 시간 문자열을 분으로 변환
  const timeStringToMinutes = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(":").map(Number);
    return hours * 60 + minutes;
  };

  // 시간 포맷팅
  const formatTime = (time: string): string => {
    return time.substring(0, 5); // HH:mm 형식으로 변환
  };

  // 날짜 포맷팅
  const formatDate = (date: Date): string => {
    const dateLocale = dateLocales[locale];
    return format(date, "MM/dd", { locale: dateLocale });
  };

  // 요일 포맷팅
  const formatWeekday = (date: Date): string => {
    const dateLocale = dateLocales[locale];
    return format(date, "EEE", { locale: dateLocale });
  };

  // 셀 클릭 핸들러
  const handleCellClick = (
    userId: string,
    date: string,
    timeSlot: TimeSlot
  ) => {
    if (canManage) {
      setSelectedCell({ userId, date, timeSlot: timeSlot.startTime });
      onUserClick?.(userId, date);
    }
  };

  // 출근 불가 토글 핸들러
  const handleAvailabilityToggle = (
    userId: string,
    date: string,
    isUnavailable: boolean
  ) => {
    if (canManage) {
      onAvailabilityToggle?.(userId, date, isUnavailable);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {t("schedule.weekGrid", locale)}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">
              {t("common.loading", locale)}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (timeSlots.length === 0) {
    console.log("timeSlots가 비어있습니다. businessHours:", businessHours);
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {t("schedule.weekGrid", locale)}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <Clock className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-2">
              {t("schedule.noBusinessHours", locale)}
            </p>
            <p className="text-xs text-muted-foreground">
              매장 설정에서 영업 시간을 등록해주세요.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {t("schedule.weekGrid", locale)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="min-w-full">
              {/* 상단 사용자 이름표 */}
              <div className="flex gap-1 mb-2">
                <div className="w-32 flex-shrink-0"></div>
                {weekDays.map((day, dayIndex) => (
                  <div key={dayIndex} className="flex-1">
                    <div className="p-2 text-center border rounded-md bg-muted/50">
                      <div className="text-sm font-semibold">
                        {formatWeekday(day)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(day)}
                      </div>
                    </div>
                    {/* 사용자 이름표들 */}
                    <div className="mt-1 space-y-1">
                      {users.map((user) => (
                        <div
                          key={user.id}
                          className="p-1 border rounded text-xs bg-background"
                        >
                          <div className="flex items-center gap-1">
                            <Avatar className="h-4 w-4">
                              <AvatarFallback className="text-xs">
                                {user.name.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="truncate">{user.name}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* 시간 기반 그리드 */}
              {timeSlots.map((timeSlot, slotIndex) => (
                <div key={slotIndex} className="grid grid-cols-8 gap-1 mb-1">
                  {/* 시간 슬롯 헤더 */}
                  <div className="p-2 border rounded-md bg-muted/50 flex items-center justify-center">
                    <div className="text-sm font-medium">
                      {timeSlot.startTime}
                    </div>
                  </div>

                  {/* 각 날짜별 셀 */}
                  {weekDays.map((day, dayIndex) => {
                    const dayStr = day.toISOString().split("T")[0];
                    const dayOfWeek = day.getDay();

                    // 해당 요일의 영업 시간 확인
                    const dayBusinessHour = businessHours.find(
                      (h) => h.weekday === dayOfWeek
                    );
                    // close_min이 0인 경우 자정(1440분)으로 처리
                    const closeMin =
                      dayBusinessHour?.close_min === 0
                        ? 1440
                        : dayBusinessHour?.close_min ?? 0;
                    const isBusinessHour =
                      dayBusinessHour &&
                      timeSlot.startMin >= dayBusinessHour.open_min &&
                      timeSlot.startMin < closeMin;

                    return (
                      <div
                        key={dayIndex}
                        className={`
                          p-2 border rounded-md min-h-[60px] cursor-pointer transition-colors
                          ${
                            isBusinessHour
                              ? "bg-background hover:bg-muted/50"
                              : "bg-muted/20"
                          }
                        `}
                        onClick={() => {
                          if (isBusinessHour) {
                            // 시간 슬롯 클릭 시 첫 번째 사용자와 연결
                            if (users.length > 0) {
                              handleCellClick(users[0].id, dayStr, timeSlot);
                            }
                          }
                        }}
                      >
                        {isBusinessHour ? (
                          <div className="space-y-1">
                            {users.map((user) => {
                              const userAssignments =
                                getAssignmentsForUserDateTime(
                                  user.id,
                                  dayStr,
                                  timeSlot
                                );
                              const availability = getAvailabilityForUserDate(
                                user.id,
                                dayStr
                              );
                              const isUnavailable = availability !== null;

                              if (isUnavailable) {
                                return (
                                  <Tooltip key={user.id}>
                                    <TooltipTrigger asChild>
                                      <div className="p-1 rounded text-xs bg-red-100 text-red-800 border border-red-200">
                                        <div className="flex items-center gap-1">
                                          <AlertCircle className="h-3 w-3" />
                                          <span className="truncate">
                                            {user.name}
                                          </span>
                                        </div>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <div className="text-sm">
                                        <div className="font-medium">
                                          {t(
                                            "availability.unavailable",
                                            locale
                                          )}
                                        </div>
                                        {availability.reason && (
                                          <div className="text-muted-foreground">
                                            {availability.reason}
                                          </div>
                                        )}
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                );
                              }

                              if (userAssignments.length > 0) {
                                return (
                                  <div key={user.id} className="space-y-1">
                                    {userAssignments.map((assignment) => (
                                      <Tooltip key={assignment.id}>
                                        <TooltipTrigger asChild>
                                          <div
                                            className={`
                                              p-1 rounded text-xs cursor-pointer
                                              ${
                                                assignment.status ===
                                                "CONFIRMED"
                                                  ? "bg-green-100 text-green-800 border border-green-200"
                                                  : "bg-blue-100 text-blue-800 border border-blue-200"
                                              }
                                            `}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onAssignmentClick?.(assignment);
                                            }}
                                          >
                                            <div className="flex items-center gap-1">
                                              <Clock className="h-3 w-3" />
                                              <span className="font-medium truncate">
                                                {assignment.workItemName}
                                              </span>
                                            </div>
                                            <div className="text-xs opacity-75">
                                              {formatTime(assignment.startTime)}{" "}
                                              - {formatTime(assignment.endTime)}
                                            </div>
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <div className="text-sm">
                                            <div className="font-medium">
                                              {assignment.workItemName}
                                            </div>
                                            <div className="text-muted-foreground">
                                              {formatTime(assignment.startTime)}{" "}
                                              - {formatTime(assignment.endTime)}
                                            </div>
                                            <div className="text-xs mt-1">
                                              {user.name}
                                            </div>
                                          </div>
                                        </TooltipContent>
                                      </Tooltip>
                                    ))}
                                  </div>
                                );
                              }

                              return null;
                            })}
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-full text-muted-foreground">
                            <span className="text-xs">
                              {t("schedule.closed", locale)}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* 하단 사용자 이름표 */}
              <div className="flex gap-1 mt-2">
                <div className="w-32 flex-shrink-0"></div>
                {weekDays.map((day, dayIndex) => (
                  <div key={dayIndex} className="flex-1">
                    <div className="p-1 border rounded text-xs bg-muted/30">
                      <div className="text-center text-muted-foreground">
                        {t("schedule.staff", locale)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
