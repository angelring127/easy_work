"use client";

import { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  Users,
  AlertCircle,
  CheckCircle,
  Loader2,
} from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
    status?: string;
    deleted_at?: string | null;
  }>;
  onAssignmentClick?: (assignment: ScheduleAssignment) => void;
  onUserClick?: (userId: string, date: string) => void;
  onAvailabilityToggle?: (
    userId: string,
    date: string,
    isUnavailable: boolean
  ) => void;
  onScheduleChange?: () => void; // 스케줄 변경 시 콜백
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
  onScheduleChange,
  canManage = false,
}: WeekGridProps) {
  const [loading, setLoading] = useState(false);
  const [businessHours, setBusinessHours] = useState<BusinessHour[]>([]);
  const [shiftBoundaryTimeMin, setShiftBoundaryTimeMin] = useState<number>(720); // 기본값: 12:00
  const [selectedCell, setSelectedCell] = useState<{
    userId: string;
    date: string;
  } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalCell, setModalCell] = useState<{
    userId: string;
    date: string;
    userName: string;
  } | null>(null);
  const [workItems, setWorkItems] = useState<
    Array<{
      id: string;
      name: string;
      start_min: number;
      end_min: number;
    }>
  >([]);
  const [selectedWorkItem, setSelectedWorkItem] = useState<string>("");
  const [isModalLoading, setIsModalLoading] = useState(false);
  const [showTransferMode, setShowTransferMode] = useState(false);
  const [selectedTransferUserId, setSelectedTransferUserId] = useState<string>("");

  // 週の日付 범위 계산
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }); // 월요일 시작
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // 매장 정보 및 영업 시간 조회
  useEffect(() => {
    const fetchStoreData = async () => {
      try {
        setLoading(true);

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

    const fetchWorkItems = async () => {
      if (!storeId) return;

      try {
        const response = await fetch(`/api/work-items?store_id=${storeId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setWorkItems(data.data || []);
          }
        }
      } catch (error) {
        console.error("근무 항목 조회 오류:", error);
      }
    };

    if (storeId) {
      fetchStoreData();
      fetchWorkItems();
    }
  }, [storeId]);

  // 사용자 목록 추출 (매장 사용자 우선, 배정/출근불가 사용자 추가)
  const allUserIds = new Set([
    ...storeUsers.map((u) => u.id),
    ...assignments.map((a) => a.userId),
    ...userAvailabilities.map((a) => a.userId),
  ]);

  const users = Array.from(allUserIds)
    .map((userId) => {
      // 매장 사용자 정보 우선 사용
      const storeUser = storeUsers.find((u) => u.id === userId);
      if (storeUser) {
        // 비활성화되거나 삭제된 유저 필터링
        if (storeUser.status === "INACTIVE" || storeUser.deleted_at) {
          return null;
        }

        return {
          id: userId,
          name: storeUser.name,
          roles: storeUser.roles,
        };
      }

      // 배정/출근불가에서 사용자 정보 추출
      const assignment = assignments.find((a) => a.userId === userId);
      const availability = userAvailabilities.find((a) => a.userId === userId);
      const userName = assignment?.userName || availability?.userName || "";

      // Unknown User는 필터링
      if (!userName || userName === "Unknown User") {
        return null;
      }

      return {
        id: userId,
        name: userName,
        roles: assignment?.userRoles || [],
      };
    })
    .filter((user) => user !== null) as Array<{
    id: string;
    name: string;
    roles: string[];
  }>;

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

  // 분을 시간:분 형식으로 변환
  const formatTimeFromMinutes = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}`;
  };

  // 날짜 포맷팅
  const formatDate = (date: Date): string => {
    const dateLocale = dateLocales[locale];
    return format(date, "MM/dd", { locale: dateLocale });
  };

  // 오전/오후 인원수 계산
  const getShiftCounts = (
    date: Date
  ): { morning: number; afternoon: number } => {
    const dayStr = date.toISOString().split("T")[0];
    const dayAssignments = assignments.filter(
      (a) => a.date === dayStr && a.status === "ASSIGNED"
    );

    let morningCount = 0;
    let afternoonCount = 0;

    // 각 배정에 대해 오전/오후 카운트
    dayAssignments.forEach((assignment) => {
      const startMin =
        parseInt(assignment.startTime.split(":")[0]) * 60 +
        parseInt(assignment.startTime.split(":")[1]);
      const endMin =
        parseInt(assignment.endTime.split(":")[0]) * 60 +
        parseInt(assignment.endTime.split(":")[1]);

      // 오전 시간대에 근무하는 경우 (시작 시간이 구분 시간 이전)
      if (startMin < shiftBoundaryTimeMin) {
        morningCount++;
      }

      // 오후 시간대에 근무하는 경우 (종료 시간이 구분 시간 이후)
      if (endMin > shiftBoundaryTimeMin) {
        afternoonCount++;
      }
    });

    return { morning: morningCount, afternoon: afternoonCount };
  };

  // 사용자의 총 스케줄 시간 계산
  const getUserTotalHours = (userId: string): number => {
    const userAssignments = assignments.filter(
      (a) => a.userId === userId && a.status === "ASSIGNED"
    );

    let totalMinutes = 0;
    userAssignments.forEach((assignment) => {
      const startMin =
        parseInt(assignment.startTime.split(":")[0]) * 60 +
        parseInt(assignment.startTime.split(":")[1]);
      let endMin =
        parseInt(assignment.endTime.split(":")[0]) * 60 +
        parseInt(assignment.endTime.split(":")[1]);

      // 자정을 넘어가는 경우 처리 (예: 10:00 - 24:00)
      if (endMin <= startMin) {
        endMin += 24 * 60; // 24시간(1440분) 추가
      }

      totalMinutes += endMin - startMin;
    });

    return Math.round((totalMinutes / 60) * 10) / 10; // 소수점 첫째자리까지
  };

  // 요일 포맷팅
  const formatWeekday = (date: Date): string => {
    const dateLocale = dateLocales[locale];
    return format(date, "EEE", { locale: dateLocale });
  };

  // 셀 클릭 핸들러
  const handleCellClick = (userId: string, date: string) => {
    const user = users.find((u) => u.id === userId);
    if (user) {
      setModalCell({ userId, date, userName: user.name });
      setSelectedWorkItem(""); // 항상 선택 초기화
      setIsModalOpen(true);
    }
    setSelectedCell({ userId, date });
    onUserClick?.(userId, date);
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

              {/* 오전/오후 라벨 행 */}
              <div className="grid grid-cols-8 gap-1 mb-2">
                <div className="p-2 text-center border rounded-md bg-muted/30">
                  <div className="flex flex-col gap-1">
                    <div className="text-xs text-blue-600 font-medium">
                      {t("schedule.morningStaff", locale)}
                    </div>
                    <div className="text-xs text-orange-600 font-medium">
                      {t("schedule.afternoonStaff", locale)}
                    </div>
                  </div>
                </div>
                {weekDays.map((day, index) => {
                  const { morning, afternoon } = getShiftCounts(day);
                  return (
                    <div
                      key={index}
                      className="p-2 text-center border rounded-md bg-muted/30"
                    >
                      <div className="flex flex-col gap-1">
                        <div className="text-xs text-blue-600 font-medium">
                          {morning}
                        </div>
                        <div className="text-xs text-orange-600 font-medium">
                          {afternoon}
                        </div>
                      </div>
                    </div>
                  );
                })}
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
                        <div className="text-xs text-blue-600 font-medium">
                          {getUserTotalHours(user.id)}h
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
                          handleCellClick(user.id, dayStr);
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
                                      // 스케줄 클릭 시에도 모달 열기
                                      handleCellClick(user.id, dayStr);
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
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            ))}
                          </div>
                        ) : isBusinessDay ? (
                          // 빈 근무 셀
                          <div className="flex items-center justify-center h-full text-muted-foreground opacity-50">
                            <span className="text-xs">-</span>
                          </div>
                        ) : (
                          // 휴무일
                          <div className="flex items-center justify-center h-full text-muted-foreground opacity-30">
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

      {/* 선택 모달 */}
      <Dialog
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open) {
            // 모달이 닫힐 때 선택된 근무 항목 및 이전 모드 초기화
            setSelectedWorkItem("");
            setShowTransferMode(false);
            setSelectedTransferUserId("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {modalCell && (
                <>
                  {modalCell.userName} -{" "}
                  {format(new Date(modalCell.date), "MM/dd (EEE)", {
                    locale: dateLocales[locale],
                  })}
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              {t("schedule.selectAction", locale)}
            </div>

            {/* 기존 스케줄 정보 표시 */}
            {modalCell &&
              (() => {
                const existingAssignment = assignments.find(
                  (a) =>
                    a.userId === modalCell.userId &&
                    a.date === modalCell.date &&
                    a.status === "ASSIGNED"
                );

                if (existingAssignment) {
                  return (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <div className="text-sm font-medium text-blue-800 mb-1">
                        {t("schedule.currentSchedule", locale)}
                      </div>
                      <div className="text-sm text-blue-700">
                        {existingAssignment.workItemName} -{" "}
                        {formatTime(existingAssignment.startTime)} ~{" "}
                        {formatTime(existingAssignment.endTime)}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

            {/* 액션 선택: 근무 항목 추가/수정 또는 이전 */}
            {!showTransferMode ? (
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {t("schedule.selectWorkItem", locale)}
                </label>
                <Select
                  value={selectedWorkItem}
                  disabled={isModalLoading}
                  onValueChange={async (value) => {
                    setSelectedWorkItem(value);

                    if (value === "TRANSFER_SCHEDULE") {
                      // 이전 모드 활성화
                      setShowTransferMode(true);
                      setSelectedWorkItem("");
                      return;
                    }

                    if (value === "DELETE_SCHEDULE") {
                    // 스케줄 삭제 로직
                    if (!modalCell) return;

                    setIsModalLoading(true);
                    try {
                      const existingAssignment = assignments.find(
                        (a) =>
                          a.userId === modalCell.userId &&
                          a.date === modalCell.date
                      );

                      if (!existingAssignment) {
                        alert(t("schedule.noScheduleToDelete", locale));
                        return;
                      }

                      const response = await fetch(
                        `/api/schedule/assignments/${existingAssignment.id}`,
                        {
                          method: "DELETE",
                        }
                      );

                      if (response.ok) {
                        const result = await response.json();
                        if (result.success) {
                          if (onScheduleChange) {
                            onScheduleChange();
                          }
                          setIsModalOpen(false);
                        } else {
                          alert(t("schedule.scheduleDeleteError", locale));
                        }
                      } else {
                        alert(t("schedule.scheduleDeleteError", locale));
                      }
                    } catch (error) {
                      console.error("스케줄 삭제 오류:", error);
                      alert(t("schedule.scheduleDeleteError", locale));
                    } finally {
                      setIsModalLoading(false);
                    }
                  } else if (value && value !== "DELETE_SCHEDULE") {
                    // 스케줄 추가/수정 로직
                    if (!modalCell) return;

                    setIsModalLoading(true);

                    // 기존 스케줄이 있는지 확인
                    const existingAssignment = assignments.find(
                      (a) =>
                        a.userId === modalCell.userId &&
                        a.date === modalCell.date &&
                        a.status === "ASSIGNED"
                    );

                    try {
                      const selectedItem = workItems.find(
                        (item) => item.id === value
                      );

                      const requestData = {
                        store_id: storeId,
                        user_id: modalCell.userId,
                        work_item_id: value,
                        date: modalCell.date,
                        start_time: selectedItem?.start_min
                          ? formatTimeFromMinutes(selectedItem.start_min)
                          : "09:00",
                        end_time: selectedItem?.end_min
                          ? formatTimeFromMinutes(selectedItem.end_min)
                          : "18:00",
                      };

                      console.log("스케줄 요청 데이터:", requestData);

                      let response;

                      if (existingAssignment) {
                        // 기존 스케줄이 있으면 수정 (PATCH)
                        console.log("기존 스케줄 수정:", existingAssignment.id);
                        response = await fetch(
                          `/api/schedule/assignments/${existingAssignment.id}`,
                          {
                            method: "PATCH",
                            headers: {
                              "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                              work_item_id: value,
                              start_time: selectedItem?.start_min
                                ? formatTimeFromMinutes(selectedItem.start_min)
                                : "09:00",
                              end_time: selectedItem?.end_min
                                ? formatTimeFromMinutes(selectedItem.end_min)
                                : "18:00",
                            }),
                          }
                        );
                      } else {
                        // 기존 스케줄이 없으면 추가 (POST)
                        console.log("새 스케줄 추가");
                        response = await fetch("/api/schedule/assignments", {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                          },
                          body: JSON.stringify(requestData),
                        });
                      }

                      console.log("API 응답 상태:", response.status);

                      if (response.ok) {
                        const result = await response.json();
                        console.log("API 응답 데이터:", result);
                        if (result.success) {
                          if (onScheduleChange) {
                            onScheduleChange();
                          }
                          setIsModalOpen(false);
                        } else {
                          console.error("API 오류:", result.error);
                          alert(
                            `${t("schedule.scheduleAddError", locale)}: ${
                              result.error
                            }`
                          );
                        }
                      } else {
                        const errorText = await response.text();
                        console.error("HTTP 오류:", response.status, errorText);
                        alert(
                          `${t("schedule.scheduleAddError", locale)}: ${
                            response.status
                          }`
                        );
                      }
                    } catch (error) {
                      console.error("스케줄 처리 오류:", error);
                      alert(t("schedule.scheduleAddError", locale));
                    } finally {
                      setIsModalLoading(false);
                    }
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      isModalLoading
                        ? t("schedule.processing", locale)
                        : t("schedule.selectWorkItemPlaceholder", locale)
                    }
                  />
                  {isModalLoading && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                </SelectTrigger>
                <SelectContent>
                  {workItems.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} ({formatTimeFromMinutes(item.start_min)} -{" "}
                      {formatTimeFromMinutes(item.end_min)})
                    </SelectItem>
                  ))}
                  {/* 기존 스케줄이 있는 경우에만 삭제 및 이전 옵션 표시 */}
                  {modalCell &&
                    assignments.some(
                      (a) =>
                        a.userId === modalCell.userId &&
                        a.date === modalCell.date &&
                        a.status === "ASSIGNED"
                    ) && (
                      <>
                        <SelectItem value="TRANSFER_SCHEDULE">
                          {t("schedule.transferSchedule", locale)}
                        </SelectItem>
                        <SelectItem value="DELETE_SCHEDULE">
                          {t("schedule.deleteSchedule", locale)}
                        </SelectItem>
                      </>
                    )}
                </SelectContent>
              </Select>
            </div>
            ) : (
              /* 스케줄 이전 모드 */
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {t("schedule.transferTo", locale)}
                  </label>
                  <Select
                    value={selectedTransferUserId}
                    disabled={isModalLoading}
                    onValueChange={async (value) => {
                      if (!value || !modalCell) return;

                      setSelectedTransferUserId(value);
                      setIsModalLoading(true);

                      try {
                        // 기존 스케줄 찾기
                        const existingAssignment = assignments.find(
                          (a) =>
                            a.userId === modalCell.userId &&
                            a.date === modalCell.date &&
                            a.status === "ASSIGNED"
                        );

                        if (!existingAssignment) {
                          alert(t("schedule.noScheduleToDelete", locale));
                          setIsModalLoading(false);
                          return;
                        }

                        // 스케줄 이전 (user_id 변경)
                        const response = await fetch(
                          `/api/schedule/assignments/${existingAssignment.id}`,
                          {
                            method: "PATCH",
                            headers: {
                              "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                              user_id: value,
                            }),
                          }
                        );

                        if (response.ok) {
                          const result = await response.json();
                          if (result.success) {
                            if (onScheduleChange) {
                              onScheduleChange();
                            }
                            setIsModalOpen(false);
                          } else {
                            alert(
                              `${t("schedule.transferError", locale)}: ${
                                result.error || "Unknown error"
                              }`
                            );
                          }
                        } else {
                          const errorData = await response.json().catch(() => ({
                            error: `HTTP ${response.status}`,
                          }));
                          alert(
                            `${t("schedule.transferError", locale)}: ${
                              errorData.error || response.status
                            }`
                          );
                        }
                      } catch (error) {
                        console.error("스케줄 이전 오류:", error);
                        alert(t("schedule.transferError", locale));
                      } finally {
                        setIsModalLoading(false);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          isModalLoading
                            ? t("schedule.processing", locale)
                            : t("schedule.transferToPlaceholder", locale)
                        }
                      />
                      {isModalLoading && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      {users
                        .filter((user) => user.id !== modalCell?.userId) // 현재 유저 제외
                        .map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowTransferMode(false);
                    setSelectedTransferUserId("");
                  }}
                  disabled={isModalLoading}
                >
                  {t("common.back", locale)}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
