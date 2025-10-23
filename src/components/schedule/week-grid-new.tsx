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

// 日付フォーマット用 로케일 매핑
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
  const [selectedCell, setSelectedCell] = useState<{
    userId: string;
    date: string;
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
        const response = await fetch(
          `/api/store-business-hours?store_id=${storeId}`
        );
        const data = await response.json();

        if (data.success && data.data && data.data.length > 0) {
          setBusinessHours(data.data);
        } else {
          // 영업 시간이 없을 경우 기본값 설정
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
          setBusinessHours(defaultHours);
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
  const handleCellClick = (userId: string, date: string) => {
    if (canManage) {
      setSelectedCell({ userId, date });
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
              {/* 헤더 행 - 날짜 */}
              <div className="grid grid-cols-8 gap-1 mb-2">
                <div className="p-2 font-semibold text-sm text-muted-foreground bg-muted/50 border rounded-md">
                  {t("schedule.user", locale)}
                </div>
                {weekDays.map((day, index) => (
                  <div
                    key={index}
                    className="p-2 text-center border rounded-md bg-muted/50"
                  >
                    <div className="text-sm font-semibold">
                      {formatWeekday(day)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(day)}
                    </div>
                  </div>
                ))}
              </div>

              {/* 사용자별 행 */}
              {users.map((user) => (
                <div key={user.id} className="grid grid-cols-8 gap-1 mb-1">
                  {/* 사용자 정보 */}
                  <div className="p-2 border rounded-md bg-muted/50">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs">
                          {user.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {user.name}
                        </div>
                        {user.roles.length > 0 && (
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {user.roles.slice(0, 2).map((role, index) => (
                              <RoleBadge key={index} role={role as any} />
                            ))}
                            {user.roles.length > 2 && (
                              <Badge
                                variant="secondary"
                                className="text-xs px-1 py-0"
                              >
                                +{user.roles.length - 2}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 각 날짜별 셀 */}
                  {weekDays.map((day, dayIndex) => {
                    const dayStr = day.toISOString().split("T")[0];
                    const dayOfWeek = day.getDay();

                    // 해당 사용자의 해당 날짜 모든 배정 조회
                    const dayAssignments = assignments.filter(
                      (a) =>
                        a.userId === user.id &&
                        isSameDay(new Date(a.date), new Date(dayStr))
                    );

                    const availability = getAvailabilityForUserDate(
                      user.id,
                      dayStr
                    );
                    const isUnavailable = availability !== null;

                    // 해당 요일의 영업 시간 확인
                    const dayBusinessHour = businessHours.find(
                      (h) => h.weekday === dayOfWeek
                    );
                    const closeMin =
                      dayBusinessHour?.close_min === 0
                        ? 1440
                        : dayBusinessHour?.close_min ?? 0;
                    const isBusinessDay =
                      dayBusinessHour && dayBusinessHour.open_min < closeMin;

                    const isSelected =
                      selectedCell?.userId === user.id &&
                      selectedCell?.date === dayStr;

                    return (
                      <div
                        key={dayIndex}
                        className={`
                          p-2 border rounded-md min-h-[100px] cursor-pointer transition-colors
                          ${
                            isSelected
                              ? "bg-primary/10 border-primary"
                              : isBusinessDay
                              ? "bg-background hover:bg-muted/50"
                              : "bg-muted/20"
                          }
                          ${isUnavailable ? "bg-red-50 border-red-200" : ""}
                        `}
                        onClick={() => {
                          if (isBusinessDay) {
                            handleCellClick(user.id, dayStr);
                          }
                        }}
                      >
                        {isUnavailable ? (
                          // 출근 불가 상태
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex flex-col items-center justify-center h-full text-red-600">
                                <AlertCircle className="h-4 w-4 mb-1" />
                                <span className="text-xs font-medium text-center">
                                  {t("availability.unavailable", locale)}
                                </span>
                                {availability.reason && (
                                  <span className="text-xs text-red-500 truncate w-full text-center mt-1">
                                    {availability.reason}
                                  </span>
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="text-sm">
                                <div className="font-medium">
                                  {t("availability.unavailable", locale)}
                                </div>
                                {availability.reason && (
                                  <div className="text-muted-foreground">
                                    {availability.reason}
                                  </div>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        ) : dayAssignments.length > 0 ? (
                          // 배정된 근무들
                          <div className="space-y-1">
                            {dayAssignments.map((assignment) => (
                              <Tooltip key={assignment.id}>
                                <TooltipTrigger asChild>
                                  <div
                                    className={`
                                      p-1.5 rounded text-xs cursor-pointer
                                      ${
                                        assignment.status === "CONFIRMED"
                                          ? "bg-green-100 text-green-800 border border-green-200"
                                          : "bg-blue-100 text-blue-800 border border-blue-200"
                                      }
                                    `}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onAssignmentClick?.(assignment);
                                    }}
                                  >
                                    <div className="flex items-center gap-1 mb-0.5">
                                      <Clock className="h-3 w-3 flex-shrink-0" />
                                      <span className="font-medium truncate">
                                        {assignment.workItemName}
                                      </span>
                                    </div>
                                    <div className="text-xs opacity-75">
                                      {formatTime(assignment.startTime)} -{" "}
                                      {formatTime(assignment.endTime)}
                                    </div>
                                    {(assignment.requiredRoles?.length ?? 0) >
                                      0 && (
                                      <div className="flex gap-1 mt-1 flex-wrap">
                                        {(assignment.requiredRoles || [])
                                          .slice(0, 2)
                                          .map((role, roleIndex) => (
                                            <Badge
                                              key={roleIndex}
                                              variant="outline"
                                              className="text-xs px-1 py-0"
                                            >
                                              {role}
                                            </Badge>
                                          ))}
                                      </div>
                                    )}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="text-sm">
                                    <div className="font-medium">
                                      {assignment.workItemName}
                                    </div>
                                    <div className="text-muted-foreground">
                                      {formatTime(assignment.startTime)} -{" "}
                                      {formatTime(assignment.endTime)}
                                    </div>
                                    {(assignment.requiredRoles?.length ?? 0) >
                                      0 && (
                                      <div className="mt-1">
                                        <div className="text-xs font-medium">
                                          Required Roles:
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                          {(
                                            assignment.requiredRoles || []
                                          ).join(", ")}
                                        </div>
                                      </div>
                                    )}
                                    {assignment.notes && (
                                      <div className="mt-1">
                                        <div className="text-xs font-medium">
                                          Notes:
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                          {assignment.notes}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            ))}
                          </div>
                        ) : isBusinessDay ? (
                          // 빈 셀 (배정 가능)
                          <div className="flex items-center justify-center h-full text-muted-foreground">
                            <span className="text-xs">
                              {canManage
                                ? t("schedule.clickToAssign", locale)
                                : ""}
                            </span>
                          </div>
                        ) : (
                          // 휴무일
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

              {/* 빈 사용자가 있는 경우 */}
              {users.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">{t("schedule.noUsers", locale)}</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
