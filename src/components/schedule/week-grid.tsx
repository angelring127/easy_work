"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Calendar,
  Clock,
  Users,
  AlertCircle,
  CheckCircle,
  Loader2,
  Copy,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { RoleBadge } from "@/components/auth/role-badge";
import { AssignmentSheet } from "@/components/schedule/assignment-sheet";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
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
  addWeeks,
  subWeeks,
  differenceInDays,
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
  unpaidBreakMin?: number;
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
  const [maxMorningStaff, setMaxMorningStaff] = useState<number>(0); // 0 = 제한 없음
  const [maxAfternoonStaff, setMaxAfternoonStaff] = useState<number>(0); // 0 = 제한 없음
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
      unpaid_break_min?: number;
    }>
  >([]);
  const [selectedWorkItem, setSelectedWorkItem] = useState<string>("");
  const [isModalLoading, setIsModalLoading] = useState(false);
  const [showTransferMode, setShowTransferMode] = useState(false);
  const [selectedTransferUserId, setSelectedTransferUserId] =
    useState<string>("");
  const [showWarningDialog, setShowWarningDialog] = useState(false);
  const [warningData, setWarningData] = useState<{
    type:
      | "DESIRED_HOURS"
      | "DIFFICULT_DAY"
      | "MAX_STAFF"
      | "TRANSFER_DESIRED_HOURS"
      | "TRANSFER_DIFFICULT_DAY"
      | "UNAVAILABLE"
      | "MULTI_DAY";
    userName: string;
    // DESIRED_HOURS, TRANSFER_DESIRED_HOURS용
    currentHours?: number;
    desiredHours?: number;
    newHours?: number;
    totalHours?: number;
    // DIFFICULT_DAY, TRANSFER_DIFFICULT_DAY용
    difficultDayName?: string;
    weekday?: number;
    // MAX_STAFF용
    shiftType?: "morning" | "afternoon";
    currentStaff?: number;
    maxStaff?: number;
    // UNAVAILABLE용
    date?: string;
    reason?: string;
    // MULTI_DAY용
    multiDayWarnings?: Array<{
      date: string;
      warnings: Array<{
        type: "DESIRED_HOURS" | "DIFFICULT_DAY" | "MAX_STAFF" | "UNAVAILABLE";
        data: any;
      }>;
    }>;
  } | null>(null);
  const [pendingScheduleData, setPendingScheduleData] = useState<{
    requestData: any;
    existingAssignment: ScheduleAssignment | undefined;
  } | null>(null);
  const [isMultiDayModalOpen, setIsMultiDayModalOpen] = useState(false);
  const [multiDayModalUser, setMultiDayModalUser] = useState<{
    userId: string;
    userName: string;
  } | null>(null);
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set());
  const [multiDayWarnings, setMultiDayWarnings] = useState<
    Array<{
      date: string;
      warnings: Array<{
        type: "DESIRED_HOURS" | "DIFFICULT_DAY" | "MAX_STAFF" | "UNAVAILABLE";
        data: any;
      }>;
    }>
  >([]);
  const [userDifficultDays, setUserDifficultDays] = useState<
    Map<string, Set<number>>
  >(new Map());
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [copyWarningDialogOpen, setCopyWarningDialogOpen] = useState(false);
  const [selectedSourceWeek, setSelectedSourceWeek] = useState<Date | null>(
    null
  );
  const [isCopying, setIsCopying] = useState(false);
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

  // 週の日付 범위 계산
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }); // 월요일 시작
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // 현재 주 범위의 날짜 문자열 (로컬 시간대 기준으로 계산)
  const weekStartStr = useMemo(
    () => format(weekStart, "yyyy-MM-dd"),
    [weekStart]
  );
  const weekEndStr = useMemo(() => format(weekEnd, "yyyy-MM-dd"), [weekEnd]);

  // 현재 주 범위 내의 스케줄만 필터링 (핵심 수정)
  const filteredAssignments = useMemo(() => {
    const filtered = assignments.filter((a) => {
      const isInCurrentWeek = a.date >= weekStartStr && a.date <= weekEndStr;
      return isInCurrentWeek;
    });

    // 디버깅 로그 (개발 모드에서만)
    if (
      process.env.NODE_ENV === "development" &&
      filtered.length !== assignments.length
    ) {
      console.log("스케줄 필터링:", {
        원본개수: assignments.length,
        필터링개수: filtered.length,
        weekStartStr,
        weekEndStr,
        제외된날짜들: assignments
          .filter((a) => a.date < weekStartStr || a.date > weekEndStr)
          .map((a) => a.date),
      });
    }

    return filtered;
  }, [assignments, weekStartStr, weekEndStr]);

  // 매장 정보 및 영업 시간 조회
  useEffect(() => {
    const fetchStoreData = async () => {
      try {
        setLoading(true);

        // 매장 정보 조회 (shift_boundary_time_min, max_morning_staff, max_afternoon_staff 포함)
        const storeResponse = await fetch(`/api/stores/${storeId}`);
        const storeData = await storeResponse.json();
        if (storeData.success && storeData.data) {
          setShiftBoundaryTimeMin(
            storeData.data.shift_boundary_time_min ?? 720
          );
          setMaxMorningStaff(storeData.data.max_morning_staff ?? 0);
          setMaxAfternoonStaff(storeData.data.max_afternoon_staff ?? 0);
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
    ...filteredAssignments.map((a) => a.userId),
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
      const assignment = filteredAssignments.find((a) => a.userId === userId);
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
    .filter((user) => user !== null)
    .sort((a, b) => {
      // 이름순 정렬 (export와 동일한 순서)
      return a.name.localeCompare(b.name);
    }) as Array<{
    id: string;
    name: string;
    roles: string[];
  }>;

  // 사용자별 difficult days 조회
  useEffect(() => {
    const fetchUserDifficultDays = async () => {
      if (!storeId || users.length === 0) return;

      const difficultDaysMap = new Map<string, Set<number>>();

      await Promise.all(
        users.map(async (user) => {
          try {
            const response = await fetch(
              `/api/stores/${storeId}/users/${user.id}`
            );
            const result = await response.json();

            if (result.success && result.data?.preferredWeekdays) {
              const difficultDays = new Set<number>();
              result.data.preferredWeekdays.forEach(
                (pw: { weekday: number; is_preferred: boolean }) => {
                  if (pw.is_preferred) {
                    difficultDays.add(pw.weekday);
                  }
                }
              );
              difficultDaysMap.set(user.id, difficultDays);
            }
          } catch (error) {
            console.error(
              `사용자 ${user.id}의 difficult days 조회 오류:`,
              error
            );
          }
        })
      );

      setUserDifficultDays(difficultDaysMap);
    };

    fetchUserDifficultDays();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, allUserIds.size]);

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

  // 역할 이니셜 변환
  const getRoleInitial = (role: string): string => {
    const roleMap: Record<string, string> = {
      MASTER: "M",
      SUB_MANAGER: "S",
      PART_TIMER: "P",
    };
    return roleMap[role] || role.charAt(0).toUpperCase();
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
    const dayAssignments = filteredAssignments.filter(
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

  // 사용자의 총 스케줄 시간 계산 (Unpaid Break 제외)
  // 현재 주의 스케줄만 계산 (filteredAssignments 사용)
  const getUserTotalHours = (
    userId: string,
    includeNewAssignment?: {
      startTime: string;
      endTime: string;
      unpaidBreakMin?: number;
    }
  ): number => {
    // filteredAssignments는 이미 현재 주 범위로 필터링됨
    const userAssignments = filteredAssignments.filter(
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

      // 근무 시간 계산
      const workMinutes = endMin - startMin;

      // Unpaid Break 시간 제외
      const unpaidBreakMin = assignment.unpaidBreakMin || 0;
      const paidMinutes = workMinutes - unpaidBreakMin;

      totalMinutes += paidMinutes;
    });

    // 새 스케줄 포함 계산
    if (includeNewAssignment) {
      const startMin =
        parseInt(includeNewAssignment.startTime.split(":")[0]) * 60 +
        parseInt(includeNewAssignment.startTime.split(":")[1]);
      let endMin =
        parseInt(includeNewAssignment.endTime.split(":")[0]) * 60 +
        parseInt(includeNewAssignment.endTime.split(":")[1]);

      if (endMin <= startMin) {
        endMin += 24 * 60;
      }

      const workMinutes = endMin - startMin;
      const unpaidBreakMin = includeNewAssignment.unpaidBreakMin || 0;
      const paidMinutes = workMinutes - unpaidBreakMin;

      totalMinutes += paidMinutes;
    }

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

  // 유저명 클릭 핸들러 (복수 요일 선택 모달)
  const handleUserNameClick = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (user && canManage) {
      setMultiDayModalUser({ userId, userName: user.name });
      setSelectedDays(new Set());
      setMultiDayWarnings([]);
      setIsMultiDayModalOpen(true);
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
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {t("schedule.weekGrid", locale)}
            </CardTitle>
            {/* Debug: canManage={String(canManage)} */}
            {canManage ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCopyDialogOpen(true)}
                className="flex items-center gap-2 min-h-[44px] touch-manipulation"
              >
                <Copy className="h-4 w-4" />
                <span>{t("schedule.copyWeek", locale)}</span>
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-2 md:mx-0">
            <div className="min-w-max px-2 md:px-0">
              {/* 헤더 행 - 날짜 */}
              <div className="grid grid-cols-8 gap-px md:gap-1 mb-0.5 md:mb-2 min-w-max">
                <div className="min-w-[50px] md:min-w-0 md:w-auto p-0.5 md:p-3 font-semibold text-[9px] md:text-sm text-muted-foreground bg-muted/50 border rounded-sm md:rounded-md">
                  {t("schedule.user", locale)}
                </div>
                {weekDays.map((day, index) => (
                  <div
                    key={index}
                    className="min-w-[32px] md:min-w-0 md:w-auto p-0.5 md:p-3 text-center border rounded-sm md:rounded-md bg-muted/50"
                  >
                    <div className="text-[9px] md:text-sm font-semibold">
                      {formatWeekday(day)}
                    </div>
                    <div className="text-[8px] md:text-xs text-muted-foreground">
                      {formatDate(day)}
                    </div>
                  </div>
                ))}
              </div>

              {/* 오전/오후 라벨 행 */}
              <div className="grid grid-cols-8 gap-px md:gap-1 mb-0.5 md:mb-2 min-w-max">
                <div className="min-w-[50px] md:min-w-0 md:w-auto p-0.5 md:p-2 text-center border rounded-sm md:rounded-md bg-muted/30">
                  <div className="flex flex-col gap-px">
                    <div className="text-[8px] md:text-xs text-blue-600 font-medium">
                      {t("schedule.morningStaff", locale)}
                    </div>
                    <div className="text-[8px] md:text-xs text-orange-600 font-medium">
                      {t("schedule.afternoonStaff", locale)}
                    </div>
                  </div>
                </div>
                {weekDays.map((day, index) => {
                  const { morning, afternoon } = getShiftCounts(day);
                  return (
                    <div
                      key={index}
                      className="min-w-[32px] md:min-w-0 md:w-auto p-0.5 md:p-2 text-center border rounded-sm md:rounded-md bg-muted/30"
                    >
                      <div className="flex flex-col gap-px">
                        <div className="text-[9px] md:text-xs text-blue-600 font-medium">
                          {morning}
                        </div>
                        <div className="text-[9px] md:text-xs text-orange-600 font-medium">
                          {afternoon}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 사용자별 행 */}
              {users.map((user) => (
                <div key={user.id} className="grid grid-cols-8 gap-px md:gap-1 mb-px md:mb-1 min-w-max">
                  {/* 사용자 정보 */}
                  <div
                    className={`min-w-[50px] md:min-w-0 md:w-auto p-0.5 md:p-2 border rounded-sm md:rounded-md bg-muted/50 ${
                      canManage
                        ? "cursor-pointer hover:bg-muted/70 transition-colors touch-manipulation"
                        : ""
                    }`}
                    onClick={() => handleUserNameClick(user.id)}
                  >
                    <div className="flex items-center gap-0.5 md:gap-2">
                      <Avatar className="h-3 w-3 md:h-6 md:w-6">
                        <AvatarFallback className="text-[8px] md:text-xs">
                          {user.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="text-[9px] md:text-sm font-medium truncate">
                          {user.name}
                        </div>
                        <div className="text-[8px] md:text-xs text-blue-600 font-medium">
                          {getUserTotalHours(user.id)}h
                        </div>
                        {user.roles.length > 0 && (
                          <div className="flex gap-0.5 mt-px flex-wrap items-center">
                            <span className="text-[7px] md:text-xs font-semibold text-muted-foreground">
                              {user.roles.map(getRoleInitial).join("/")}
                            </span>
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
                    const dayAssignments = filteredAssignments.filter(
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

                    // Difficult day 체크
                    const userDifficultDaysSet = userDifficultDays.get(user.id);
                    const isDifficultDay =
                      userDifficultDaysSet?.has(dayOfWeek) || false;

                    return (
                      <div
                        key={dayIndex}
                        className={`
                          min-w-[32px] md:min-w-0 md:w-auto p-px md:p-2 border rounded-sm md:rounded-md min-h-[48px] md:min-h-[100px] cursor-pointer transition-colors touch-manipulation
                          ${
                            isSelected
                              ? "bg-primary/10 border-primary"
                              : isBusinessDay
                              ? "bg-background hover:bg-muted/50"
                              : "bg-muted/20"
                          }
                          ${isUnavailable ? "bg-red-50 border-red-200" : ""}
                          ${
                            isDifficultDay && !isUnavailable
                              ? "bg-yellow-50 border-yellow-200"
                              : ""
                          }
                        `}
                        onClick={() => {
                          handleCellClick(user.id, dayStr);
                        }}
                      >
                        <div className="space-y-px md:space-y-1">
                          {/* Unavailable 표시 (스케줄과 함께 표시) */}
                          {isUnavailable && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-px p-px md:p-1 rounded-sm md:rounded bg-red-50 border border-red-200 text-red-600">
                                  <AlertCircle className="h-2 w-2 md:h-3 md:w-3 flex-shrink-0" />
                                  <span className="text-[8px] md:text-xs font-medium truncate">
                                    X
                                  </span>
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
                          )}

                          {/* 배정된 근무들 */}
                          {dayAssignments.length > 0
                            ? dayAssignments.map((assignment) => (
                                <Tooltip key={assignment.id}>
                                  <TooltipTrigger asChild>
                                    <div
                                      className={`
                                      p-px md:p-1.5 rounded-sm md:rounded text-xs cursor-pointer
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
                                      {/* 워크 아이템 이름 - 모바일에서는 축약 */}
                                      <div className="flex items-center gap-px mb-px">
                                        <Clock className="h-2 w-2 md:h-3 md:w-3 flex-shrink-0" />
                                        <span className="font-medium truncate text-[8px] md:text-xs leading-tight">
                                          <span className="md:hidden">{assignment.workItemName.slice(0, 3)}</span>
                                          <span className="hidden md:inline">{assignment.workItemName}</span>
                                        </span>
                                      </div>
                                      {/* 시간 - 두 줄로 표시 */}
                                      <div className="text-[7px] md:text-xs opacity-75 leading-tight">
                                        <div className="md:hidden space-y-px">
                                          <div className="flex items-center gap-px">
                                            <span className="opacity-50">▼</span>
                                            <span>{formatTime(assignment.startTime)}</span>
                                          </div>
                                          <div className="flex items-center gap-px">
                                            <span className="opacity-50">▲</span>
                                            <span>{formatTime(assignment.endTime)}</span>
                                          </div>
                                        </div>
                                        <div className="hidden md:block">
                                          {formatTime(assignment.startTime)}-{formatTime(assignment.endTime)}
                                        </div>
                                      </div>
                                      {/* 역할 이니셜 표시 */}
                                      {(assignment.requiredRoles?.length ?? 0) > 0 && (
                                        <div className="flex gap-px mt-px flex-wrap">
                                          {(assignment.requiredRoles || [])
                                            .slice(0, 3)
                                            .map((role, roleIndex) => (
                                              <span
                                                key={roleIndex}
                                                className="text-[7px] md:text-xs font-semibold opacity-60"
                                              >
                                                {getRoleInitial(role)}
                                              </span>
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
                              ))
                            : isBusinessDay
                            ? // 빈 근무 셀 (unavailable이 없을 때만 표시)
                              !isUnavailable && (
                                <div className="flex items-center justify-center h-full text-muted-foreground opacity-50">
                                  <span className="text-xs">-</span>
                                </div>
                              )
                            : // 휴무일 (unavailable이 없을 때만 표시)
                              !isUnavailable && (
                                <div className="flex items-center justify-center h-full text-muted-foreground opacity-30">
                                  <span className="text-xs">
                                    {t("schedule.closed", locale)}
                                  </span>
                                </div>
                              )}
                        </div>
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
                const existingAssignment = filteredAssignments.find(
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
                        const existingAssignment = filteredAssignments.find(
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
                      if (!modalCell || !modalCell.userId) {
                        console.error(
                          "modalCell 또는 userId가 없습니다:",
                          modalCell
                        );
                        alert(t("schedule.scheduleAddError", locale));
                        return;
                      }

                      setIsModalLoading(true);

                      // 기존 스케줄이 있는지 확인
                      const existingAssignment = filteredAssignments.find(
                        (a) =>
                          a.userId === modalCell.userId &&
                          a.date === modalCell.date &&
                          a.status === "ASSIGNED"
                      );

                      try {
                        const selectedItem = workItems.find(
                          (item) => item.id === value
                        );

                        const startTime = selectedItem?.start_min
                          ? formatTimeFromMinutes(selectedItem.start_min)
                          : "09:00";
                        const endTime = selectedItem?.end_min
                          ? formatTimeFromMinutes(selectedItem.end_min)
                          : "18:00";

                        const requestData = {
                          store_id: storeId,
                          user_id: modalCell.userId,
                          work_item_id: value,
                          date: modalCell.date,
                          start_time: startTime,
                          end_time: endTime,
                        };

                        // 경고 확인 (새 스케줄 추가 시에만)
                        if (!existingAssignment) {
                          try {
                            // 사용자 정보 조회 (store_users 기반)
                            const userResponse = await fetch(
                              `/api/stores/${storeId}/users/${modalCell.userId}`
                            );
                            const userResult = await userResponse.json();

                            if (userResult.success && userResult.data) {
                              const userData = userResult.data;

                              // 새 스케줄 시간 계산
                              const startMin =
                                parseInt(startTime.split(":")[0]) * 60 +
                                parseInt(startTime.split(":")[1]);
                              let endMin =
                                parseInt(endTime.split(":")[0]) * 60 +
                                parseInt(endTime.split(":")[1]);

                              if (endMin <= startMin) {
                                endMin += 24 * 60;
                              }

                              const workMinutes = endMin - startMin;
                              const unpaidBreakMin =
                                selectedItem?.unpaid_break_min || 0;
                              const newHours =
                                Math.round(
                                  ((workMinutes - unpaidBreakMin) / 60) * 10
                                ) / 10;
                              const totalHours = getUserTotalHours(
                                modalCell.userId,
                                {
                                  startTime,
                                  endTime,
                                  unpaidBreakMin,
                                }
                              );

                              // 1. Difficult Work Days 확인
                              const scheduleDate = new Date(modalCell.date);
                              const scheduleWeekday = scheduleDate.getDay(); // 0=일요일, 6=토요일
                              const preferredWeekdays =
                                userData.preferredWeekdays || [];
                              const isDifficultDay = preferredWeekdays.some(
                                (pw: {
                                  weekday: number;
                                  is_preferred: boolean;
                                }) =>
                                  pw.weekday === scheduleWeekday &&
                                  pw.is_preferred === true
                              );

                              if (isDifficultDay) {
                                const weekdayNames = [
                                  t("user.weekdays.sunday", locale),
                                  t("user.weekdays.monday", locale),
                                  t("user.weekdays.tuesday", locale),
                                  t("user.weekdays.wednesday", locale),
                                  t("user.weekdays.thursday", locale),
                                  t("user.weekdays.friday", locale),
                                  t("user.weekdays.saturday", locale),
                                ];
                                setWarningData({
                                  type: "DIFFICULT_DAY",
                                  userName: modalCell.userName,
                                  difficultDayName:
                                    weekdayNames[scheduleWeekday],
                                  weekday: scheduleWeekday,
                                });
                                setPendingScheduleData({
                                  requestData,
                                  existingAssignment,
                                });
                                setShowWarningDialog(true);
                                setIsModalLoading(false);
                                return;
                              }

                              // 2. Desired Weekly Hours 초과 확인
                              if (userData.desiredWeeklyHours) {
                                const desiredHours =
                                  userData.desiredWeeklyHours;
                                const currentHours = getUserTotalHours(
                                  modalCell.userId
                                );

                                if (totalHours > desiredHours) {
                                  setWarningData({
                                    type: "DESIRED_HOURS",
                                    userName: modalCell.userName,
                                    currentHours,
                                    desiredHours,
                                    newHours,
                                    totalHours,
                                  });
                                  setPendingScheduleData({
                                    requestData,
                                    existingAssignment,
                                  });
                                  setShowWarningDialog(true);
                                  setIsModalLoading(false);
                                  return;
                                }
                              }

                              // 3. Max Morning/Afternoon Staff 확인
                              const scheduleDay = weekDays.find(
                                (day) =>
                                  format(day, "yyyy-MM-dd") === modalCell.date
                              );
                              if (scheduleDay) {
                                const {
                                  morning: currentMorning,
                                  afternoon: currentAfternoon,
                                } = getShiftCounts(scheduleDay);

                                // 새 스케줄이 오전인지 오후인지 확인
                                const startMinForShift =
                                  parseInt(startTime.split(":")[0]) * 60 +
                                  parseInt(startTime.split(":")[1]);
                                const isMorningShift =
                                  startMinForShift < shiftBoundaryTimeMin;

                                // 새 스케줄 추가 후 인원 수 계산
                                const newMorningCount = isMorningShift
                                  ? currentMorning + 1
                                  : currentMorning;
                                const newAfternoonCount = !isMorningShift
                                  ? currentAfternoon + 1
                                  : currentAfternoon;

                                // 오전 최대 인원 초과 확인
                                if (
                                  maxMorningStaff > 0 &&
                                  newMorningCount > maxMorningStaff
                                ) {
                                  setWarningData({
                                    type: "MAX_STAFF",
                                    userName: modalCell.userName,
                                    shiftType: "morning",
                                    currentStaff: currentMorning,
                                    maxStaff: maxMorningStaff,
                                  });
                                  setPendingScheduleData({
                                    requestData,
                                    existingAssignment,
                                  });
                                  setShowWarningDialog(true);
                                  setIsModalLoading(false);
                                  return;
                                }

                                // 오후 최대 인원 초과 확인
                                if (
                                  maxAfternoonStaff > 0 &&
                                  newAfternoonCount > maxAfternoonStaff
                                ) {
                                  setWarningData({
                                    type: "MAX_STAFF",
                                    userName: modalCell.userName,
                                    shiftType: "afternoon",
                                    currentStaff: currentAfternoon,
                                    maxStaff: maxAfternoonStaff,
                                  });
                                  setPendingScheduleData({
                                    requestData,
                                    existingAssignment,
                                  });
                                  setShowWarningDialog(true);
                                  setIsModalLoading(false);
                                  return;
                                }
                              }
                            }
                          } catch (error) {
                            console.error("사용자 정보 조회 오류:", error);
                            // 에러가 발생해도 스케줄 추가는 계속 진행
                          }
                        }

                        console.log("스케줄 요청 데이터:", requestData);

                        let response;

                        if (existingAssignment) {
                          // 기존 스케줄이 있으면 수정 (PATCH)
                          console.log(
                            "기존 스케줄 수정:",
                            existingAssignment.id
                          );
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
                                  ? formatTimeFromMinutes(
                                      selectedItem.start_min
                                    )
                                  : "09:00",
                                end_time: selectedItem?.end_min
                                  ? formatTimeFromMinutes(selectedItem.end_min)
                                  : "18:00",
                              }),
                            }
                          );

                          // PATCH 응답도 동일하게 처리
                          if (response.ok) {
                            const result = await response.json();
                            if (result.success) {
                              // 경고가 있는 경우 모달 표시
                              if (result.warning) {
                                const availability = getAvailabilityForUserDate(
                                  modalCell?.userId || "",
                                  modalCell?.date || ""
                                );
                                setWarningData({
                                  type: "UNAVAILABLE",
                                  userName: modalCell?.userName || "",
                                  date: modalCell?.date || "",
                                  reason: availability?.reason,
                                });
                                setPendingScheduleData({
                                  requestData: {
                                    work_item_id: value,
                                    start_time: selectedItem?.start_min
                                      ? formatTimeFromMinutes(
                                          selectedItem.start_min
                                        )
                                      : "09:00",
                                    end_time: selectedItem?.end_min
                                      ? formatTimeFromMinutes(
                                          selectedItem.end_min
                                        )
                                      : "18:00",
                                  },
                                  existingAssignment,
                                });
                                setShowWarningDialog(true);
                                setIsModalLoading(false);
                                return;
                              }

                              if (onScheduleChange) {
                                onScheduleChange();
                              }
                              setIsModalOpen(false);
                              return;
                            }
                          }
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
                            // 경고가 있는 경우 모달 표시
                            if (result.warning) {
                              const availability = getAvailabilityForUserDate(
                                modalCell?.userId || "",
                                modalCell?.date || ""
                              );
                              setWarningData({
                                type: "UNAVAILABLE",
                                userName: modalCell?.userName || "",
                                date: modalCell?.date || "",
                                reason: availability?.reason,
                              });
                              setPendingScheduleData({
                                requestData,
                                existingAssignment,
                              });
                              setShowWarningDialog(true);
                              setIsModalLoading(false);
                              return;
                            }

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
                          console.error(
                            "HTTP 오류:",
                            response.status,
                            errorText
                          );

                          // unavailable 에러인 경우 경고 모달로 처리
                          try {
                            const errorJson = JSON.parse(errorText);
                            if (
                              errorJson.error ===
                              "User is unavailable for this date"
                            ) {
                              const availability = getAvailabilityForUserDate(
                                modalCell?.userId || "",
                                modalCell?.date || ""
                              );
                              setWarningData({
                                type: "UNAVAILABLE",
                                userName: modalCell?.userName || "",
                                date: modalCell?.date || "",
                                reason: availability?.reason,
                              });
                              setPendingScheduleData({
                                requestData,
                                existingAssignment,
                              });
                              setShowWarningDialog(true);
                              setIsModalLoading(false);
                              return;
                            }
                          } catch (e) {
                            // JSON 파싱 실패 시 기존 에러 처리
                          }

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
                      filteredAssignments.some(
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
                        const existingAssignment = filteredAssignments.find(
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

                        // 이전 대상 사용자 정보 조회 (store_users 기반)
                        try {
                          const targetUserResponse = await fetch(
                            `/api/stores/${storeId}/users/${value}`
                          );
                          const targetUserResult =
                            await targetUserResponse.json();

                          if (
                            targetUserResult.success &&
                            targetUserResult.data
                          ) {
                            const targetUserData = targetUserResult.data;
                            const targetUserName =
                              users.find((u) => u.id === value)?.name ||
                              targetUserData.name;

                            // 1. Difficult Work Days 확인
                            const scheduleDate = new Date(modalCell.date);
                            const scheduleWeekday = scheduleDate.getDay(); // 0=일요일, 6=토요일
                            const preferredWeekdays =
                              targetUserData.preferredWeekdays || [];
                            const isDifficultDay = preferredWeekdays.some(
                              (pw: {
                                weekday: number;
                                is_preferred: boolean;
                              }) =>
                                pw.weekday === scheduleWeekday &&
                                pw.is_preferred === true
                            );

                            if (isDifficultDay) {
                              const weekdayNames = [
                                t("user.weekdays.sunday", locale),
                                t("user.weekdays.monday", locale),
                                t("user.weekdays.tuesday", locale),
                                t("user.weekdays.wednesday", locale),
                                t("user.weekdays.thursday", locale),
                                t("user.weekdays.friday", locale),
                                t("user.weekdays.saturday", locale),
                              ];
                              setWarningData({
                                type: "TRANSFER_DIFFICULT_DAY",
                                userName: targetUserName,
                                difficultDayName: weekdayNames[scheduleWeekday],
                                weekday: scheduleWeekday,
                              });
                              setPendingScheduleData({
                                requestData: {
                                  user_id: value,
                                },
                                existingAssignment,
                              });
                              setShowWarningDialog(true);
                              setIsModalLoading(false);
                              return;
                            }

                            // 2. Desired Weekly Hours 초과 확인
                            if (targetUserData.desiredWeeklyHours) {
                              const desiredHours =
                                targetUserData.desiredWeeklyHours;
                              const currentHours = getUserTotalHours(value);

                              // 기존 스케줄 시간 계산
                              const startMin =
                                parseInt(
                                  existingAssignment.startTime.split(":")[0]
                                ) *
                                  60 +
                                parseInt(
                                  existingAssignment.startTime.split(":")[1]
                                );
                              let endMin =
                                parseInt(
                                  existingAssignment.endTime.split(":")[0]
                                ) *
                                  60 +
                                parseInt(
                                  existingAssignment.endTime.split(":")[1]
                                );

                              if (endMin <= startMin) {
                                endMin += 24 * 60;
                              }

                              const workMinutes = endMin - startMin;
                              const unpaidBreakMin =
                                existingAssignment.unpaidBreakMin || 0;
                              const newHours =
                                Math.round(
                                  ((workMinutes - unpaidBreakMin) / 60) * 10
                                ) / 10;
                              const totalHours = getUserTotalHours(value, {
                                startTime: existingAssignment.startTime,
                                endTime: existingAssignment.endTime,
                                unpaidBreakMin,
                              });

                              if (totalHours > desiredHours) {
                                setWarningData({
                                  type: "TRANSFER_DESIRED_HOURS",
                                  userName: targetUserName,
                                  currentHours,
                                  desiredHours,
                                  newHours,
                                  totalHours,
                                });
                                setPendingScheduleData({
                                  requestData: {
                                    user_id: value,
                                  },
                                  existingAssignment,
                                });
                                setShowWarningDialog(true);
                                setIsModalLoading(false);
                                return;
                              }
                            }
                          }
                        } catch (error) {
                          console.error(
                            "이전 대상 사용자 정보 조회 오류:",
                            error
                          );
                          // 에러가 발생해도 스케줄 이전은 계속 진행
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

      {/* 경고 모달 (타입별 다른 메시지) */}
      <Dialog open={showWarningDialog} onOpenChange={setShowWarningDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertCircle className="h-5 w-5" />
              {warningData && (
                <>
                  {warningData.type === "DESIRED_HOURS" &&
                    t("schedule.warning.exceedDesiredHours", locale)}
                  {warningData.type === "DIFFICULT_DAY" &&
                    t("schedule.warning.difficultDay", locale)}
                  {warningData.type === "MAX_STAFF" &&
                    t("schedule.warning.maxStaff", locale)}
                  {warningData.type === "TRANSFER_DESIRED_HOURS" &&
                    t("schedule.warning.transferDesiredHours", locale)}
                  {warningData.type === "TRANSFER_DIFFICULT_DAY" &&
                    t("schedule.warning.transferDifficultDay", locale)}
                  {warningData.type === "UNAVAILABLE" &&
                    t("schedule.warning.unavailable", locale)}
                  {warningData.type === "MULTI_DAY" &&
                    t("schedule.multiDaySchedule", locale)}
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {warningData && (
              <>
                {/* MULTI_DAY - 복수 요일 경고 */}
                {warningData.type === "MULTI_DAY" &&
                  warningData.multiDayWarnings && (
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground mb-2">
                        <p>
                          <strong>{warningData.userName}</strong>{" "}
                          {t("schedule.warning.multiDayMessage", locale)}
                        </p>
                      </div>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {warningData.multiDayWarnings.map(
                          (dayWarning, index) => (
                            <Alert key={index} variant="destructive">
                              <AlertCircle className="h-4 w-4" />
                              <AlertTitle>
                                {format(
                                  new Date(dayWarning.date),
                                  "MM/dd (EEE)",
                                  {
                                    locale: dateLocales[locale],
                                  }
                                )}
                              </AlertTitle>
                              <AlertDescription className="space-y-1 mt-2">
                                {dayWarning.warnings.map((warning, wIndex) => (
                                  <div key={wIndex} className="text-sm">
                                    {warning.type === "UNAVAILABLE" && (
                                      <div>
                                        {t(
                                          "schedule.warning.unavailableMessage",
                                          locale
                                        )}
                                        {warning.data.reason && (
                                          <span className="ml-1">
                                            ({warning.data.reason})
                                          </span>
                                        )}
                                      </div>
                                    )}
                                    {warning.type === "DIFFICULT_DAY" && (
                                      <div>
                                        {t(
                                          "schedule.warning.difficultDayMessage",
                                          locale
                                        )}{" "}
                                        ({warning.data.difficultDayName})
                                      </div>
                                    )}
                                    {warning.type === "DESIRED_HOURS" && (
                                      <div>
                                        {t(
                                          "schedule.warning.exceedDesiredHoursMessage",
                                          locale
                                        )}{" "}
                                        {t(
                                          "schedule.warning.totalHours",
                                          locale
                                        )}
                                        : {warning.data.totalHours}h /{" "}
                                        {t(
                                          "schedule.warning.desiredHours",
                                          locale
                                        )}
                                        : {warning.data.desiredHours}h
                                      </div>
                                    )}
                                    {warning.type === "MAX_STAFF" && (
                                      <div>
                                        {t(
                                          "schedule.warning.maxStaffMessage",
                                          locale
                                        )}{" "}
                                        (
                                        {warning.data.shiftType === "morning"
                                          ? t("schedule.morningStaff", locale)
                                          : t(
                                              "schedule.afternoonStaff",
                                              locale
                                            )}
                                        )
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </AlertDescription>
                            </Alert>
                          )
                        )}
                      </div>
                    </div>
                  )}
                {/* DESIRED_HOURS 또는 TRANSFER_DESIRED_HOURS */}
                {(warningData.type === "DESIRED_HOURS" ||
                  warningData.type === "TRANSFER_DESIRED_HOURS") && (
                  <div className="text-sm text-muted-foreground">
                    <p className="mb-2">
                      <strong>{warningData.userName}</strong>{" "}
                      {warningData.type === "DESIRED_HOURS"
                        ? t(
                            "schedule.warning.exceedDesiredHoursMessage",
                            locale
                          )
                        : t(
                            "schedule.warning.transferDesiredHoursMessage",
                            locale
                          )}
                    </p>
                    <div className="space-y-1 mt-3">
                      <div className="flex justify-between">
                        <span>
                          {t("schedule.warning.currentHours", locale)}:
                        </span>
                        <span className="font-medium">
                          {warningData.currentHours}h
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>{t("schedule.warning.newHours", locale)}:</span>
                        <span className="font-medium">
                          +{warningData.newHours}h
                        </span>
                      </div>
                      <div className="flex justify-between border-t pt-1">
                        <span>{t("schedule.warning.totalHours", locale)}:</span>
                        <span className="font-medium text-amber-600">
                          {warningData.totalHours}h
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>
                          {t("schedule.warning.desiredHours", locale)}:
                        </span>
                        <span className="font-medium">
                          {warningData.desiredHours}h
                        </span>
                      </div>
                      <div className="flex justify-between text-amber-600 font-semibold">
                        <span>{t("schedule.warning.exceedBy", locale)}:</span>
                        <span>
                          +
                          {(
                            (warningData.totalHours || 0) -
                            (warningData.desiredHours || 0)
                          ).toFixed(1)}
                          h
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* DIFFICULT_DAY 또는 TRANSFER_DIFFICULT_DAY */}
                {(warningData.type === "DIFFICULT_DAY" ||
                  warningData.type === "TRANSFER_DIFFICULT_DAY") && (
                  <div className="text-sm text-muted-foreground">
                    <p className="mb-2">
                      <strong>{warningData.userName}</strong>{" "}
                      {warningData.type === "DIFFICULT_DAY"
                        ? t("schedule.warning.difficultDayMessage", locale)
                        : t(
                            "schedule.warning.transferDifficultDayMessage",
                            locale
                          )}
                    </p>
                    <div className="space-y-1 mt-3">
                      <div className="flex justify-between">
                        <span>
                          {t("schedule.warning.difficultDayName", locale)}:
                        </span>
                        <span className="font-medium text-amber-600">
                          {warningData.difficultDayName}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* MAX_STAFF */}
                {warningData.type === "MAX_STAFF" && (
                  <div className="text-sm text-muted-foreground">
                    <p className="mb-2">
                      {t("schedule.warning.maxStaffMessage", locale)}
                    </p>
                    <div className="space-y-1 mt-3">
                      <div className="flex justify-between">
                        <span>
                          {warningData.shiftType === "morning"
                            ? t("schedule.warning.maxMorningStaff", locale)
                            : t("schedule.warning.maxAfternoonStaff", locale)}
                          :
                        </span>
                        <span className="font-medium">
                          {warningData.maxStaff}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>
                          {warningData.shiftType === "morning"
                            ? t("schedule.warning.currentMorningStaff", locale)
                            : t(
                                "schedule.warning.currentAfternoonStaff",
                                locale
                              )}
                          :
                        </span>
                        <span className="font-medium text-amber-600">
                          {warningData.currentStaff} →{" "}
                          {(warningData.currentStaff || 0) + 1}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* UNAVAILABLE */}
                {warningData.type === "UNAVAILABLE" && (
                  <div className="text-sm text-muted-foreground">
                    <p className="mb-2">
                      <strong>{warningData.userName}</strong>{" "}
                      {t("schedule.warning.unavailableMessage", locale)}
                    </p>
                    <div className="space-y-1 mt-3">
                      <div className="flex justify-between">
                        <span>{t("availability.date", locale)}:</span>
                        <span className="font-medium">
                          {warningData.date
                            ? new Date(warningData.date).toLocaleDateString()
                            : ""}
                        </span>
                      </div>
                      {warningData.reason && (
                        <div className="flex justify-between">
                          <span>{t("availability.reason", locale)}:</span>
                          <span className="font-medium text-amber-600">
                            {warningData.reason}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowWarningDialog(false);
                      setWarningData(null);
                      setPendingScheduleData(null);
                      setIsModalLoading(false);
                    }}
                  >
                    {t("common.cancel", locale)}
                  </Button>
                  <Button
                    variant="default"
                    onClick={async () => {
                      if (!pendingScheduleData) return;

                      setShowWarningDialog(false);
                      setIsModalLoading(true);

                      try {
                        let response;

                        if (pendingScheduleData.requestData.multiDay) {
                          // 복수 요일 일괄 등록
                          const selectedDaysArray =
                            pendingScheduleData.requestData.selectedDays || [];
                          const promises = selectedDaysArray.map(
                            (dateStr: string) => {
                              const requestData = {
                                store_id:
                                  pendingScheduleData.requestData.store_id,
                                user_id:
                                  pendingScheduleData.requestData.user_id,
                                work_item_id:
                                  pendingScheduleData.requestData.work_item_id,
                                date: dateStr,
                                start_time:
                                  pendingScheduleData.requestData.start_time,
                                end_time:
                                  pendingScheduleData.requestData.end_time,
                              };

                              return fetch("/api/schedule/assignments", {
                                method: "POST",
                                headers: {
                                  "Content-Type": "application/json",
                                },
                                body: JSON.stringify(requestData),
                              });
                            }
                          );

                          const results = await Promise.allSettled(promises);
                          const failed = results.filter(
                            (r) =>
                              r.status === "rejected" ||
                              (r.status === "fulfilled" && !r.value.ok)
                          );

                          if (failed.length > 0) {
                            const errorMessages = await Promise.all(
                              failed.map(async (r) => {
                                if (r.status === "rejected") {
                                  return r.reason?.message || "Unknown error";
                                } else {
                                  try {
                                    const errorText = await r.value.text();
                                    return errorText;
                                  } catch {
                                    return `HTTP ${r.value.status}`;
                                  }
                                }
                              })
                            );
                            alert(
                              `${t("schedule.scheduleAddError", locale)}: ${
                                failed.length
                              }개 실패\n${errorMessages.join("\n")}`
                            );
                            setIsModalLoading(false);
                            setWarningData(null);
                            setPendingScheduleData(null);
                            return;
                          }

                          if (onScheduleChange) {
                            onScheduleChange();
                          }
                          setIsMultiDayModalOpen(false);
                          setSelectedDays(new Set());
                          setMultiDayWarnings([]);
                          setSelectedWorkItem("");
                          setIsModalLoading(false);
                          setWarningData(null);
                          setPendingScheduleData(null);
                          return;
                        } else if (pendingScheduleData.existingAssignment) {
                          // 스케줄 수정 또는 이전
                          const patchData: any = {};

                          if (pendingScheduleData.requestData.user_id) {
                            // 스케줄 이전 (user_id 변경)
                            patchData.user_id =
                              pendingScheduleData.requestData.user_id;
                          } else {
                            // 스케줄 수정 (work_item_id, start_time, end_time 변경)
                            patchData.work_item_id =
                              pendingScheduleData.requestData.work_item_id;
                            patchData.start_time =
                              pendingScheduleData.requestData.start_time;
                            patchData.end_time =
                              pendingScheduleData.requestData.end_time;
                          }

                          response = await fetch(
                            `/api/schedule/assignments/${pendingScheduleData.existingAssignment.id}`,
                            {
                              method: "PATCH",
                              headers: {
                                "Content-Type": "application/json",
                              },
                              body: JSON.stringify(patchData),
                            }
                          );
                        } else {
                          // 새 스케줄 추가
                          response = await fetch("/api/schedule/assignments", {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                            },
                            body: JSON.stringify(
                              pendingScheduleData.requestData
                            ),
                          });
                        }

                        if (response.ok) {
                          const result = await response.json();
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
                          console.error(
                            "HTTP 오류:",
                            response.status,
                            errorText
                          );
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
                        setWarningData(null);
                        setPendingScheduleData(null);
                      }
                    }}
                  >
                    {t("common.confirm", locale)}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 복수 요일 선택 모달 */}
      <Dialog
        open={isMultiDayModalOpen}
        onOpenChange={(open) => {
          setIsMultiDayModalOpen(open);
          if (!open) {
            setSelectedDays(new Set());
            setMultiDayWarnings([]);
            setSelectedWorkItem("");
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {multiDayModalUser && (
                <>
                  {multiDayModalUser.userName} -{" "}
                  {t("schedule.multiDaySchedule", locale)}
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* 근무 항목 선택 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t("schedule.selectWorkItem", locale)}
              </label>
              <Select
                value={selectedWorkItem}
                disabled={isModalLoading}
                onValueChange={(value) => {
                  setSelectedWorkItem(value);
                }}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={t(
                      "schedule.selectWorkItemPlaceholder",
                      locale
                    )}
                  />
                </SelectTrigger>
                <SelectContent>
                  {workItems.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} ({formatTimeFromMinutes(item.start_min)} -{" "}
                      {formatTimeFromMinutes(item.end_min)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 요일 선택 */}
            {selectedWorkItem && (
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {t("schedule.selectDays", locale)}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {weekDays.map((day, index) => {
                    const dayStr = day.toISOString().split("T")[0];
                    const dayOfWeek = day.getDay();
                    const dayBusinessHour = businessHours.find(
                      (h) => h.weekday === dayOfWeek
                    );
                    const closeMin =
                      dayBusinessHour?.close_min === 0
                        ? 1440
                        : dayBusinessHour?.close_min ?? 0;
                    const isBusinessDay =
                      dayBusinessHour && dayBusinessHour.open_min < closeMin;
                    const isSelected = selectedDays.has(dayStr);
                    const availability = getAvailabilityForUserDate(
                      multiDayModalUser?.userId || "",
                      dayStr
                    );
                    const isUnavailable = availability !== null;

                    // 이미 스케줄이 등록되어 있는지 확인
                    const hasExistingSchedule = filteredAssignments.some(
                      (a) =>
                        a.userId === multiDayModalUser?.userId &&
                        a.date === dayStr &&
                        a.status === "ASSIGNED"
                    );

                    return (
                      <div
                        key={index}
                        className={`flex items-center space-x-2 p-2 border rounded-md ${
                          !isBusinessDay ? "opacity-50" : ""
                        } ${isUnavailable ? "bg-red-50 border-red-200" : ""} ${
                          hasExistingSchedule ? "bg-muted/30" : ""
                        }`}
                      >
                        <Checkbox
                          id={`day-${dayStr}`}
                          checked={isSelected}
                          disabled={
                            !isBusinessDay ||
                            isModalLoading ||
                            hasExistingSchedule
                          }
                          onCheckedChange={(checked) => {
                            const newSelected = new Set(selectedDays);
                            if (checked) {
                              newSelected.add(dayStr);
                            } else {
                              newSelected.delete(dayStr);
                            }
                            setSelectedDays(newSelected);
                          }}
                        />
                        <label
                          htmlFor={`day-${dayStr}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex-1 cursor-pointer"
                        >
                          <div className="flex items-center justify-between">
                            <span>
                              {formatWeekday(day)} {formatDate(day)}
                            </span>
                            {isUnavailable && (
                              <Badge variant="destructive" className="text-xs">
                                {t("availability.unavailable", locale)}
                              </Badge>
                            )}
                          </div>
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 버튼 */}
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setIsMultiDayModalOpen(false);
                  setSelectedDays(new Set());
                  setMultiDayWarnings([]);
                  setSelectedWorkItem("");
                }}
                disabled={isModalLoading}
              >
                {t("common.cancel", locale)}
              </Button>
              <Button
                variant="default"
                onClick={async () => {
                  if (
                    !multiDayModalUser ||
                    !selectedWorkItem ||
                    selectedDays.size === 0
                  ) {
                    return;
                  }

                  setIsModalLoading(true);

                  try {
                    // 사용자 정보 조회
                    const userResponse = await fetch(
                      `/api/stores/${storeId}/users/${multiDayModalUser.userId}`
                    );
                    const userResult = await userResponse.json();

                    if (!userResult.success || !userResult.data) {
                      alert(t("schedule.scheduleAddError", locale));
                      setIsModalLoading(false);
                      return;
                    }

                    const userData = userResult.data;
                    const selectedItem = workItems.find(
                      (item) => item.id === selectedWorkItem
                    );

                    if (!selectedItem) {
                      alert(t("schedule.scheduleAddError", locale));
                      setIsModalLoading(false);
                      return;
                    }

                    const startTime = selectedItem.start_min
                      ? formatTimeFromMinutes(selectedItem.start_min)
                      : "09:00";
                    const endTime = selectedItem.end_min
                      ? formatTimeFromMinutes(selectedItem.end_min)
                      : "18:00";

                    // 각 요일별 경고 수집
                    const warnings: typeof multiDayWarnings = [];
                    const selectedDaysArray = Array.from(selectedDays);

                    for (const dateStr of selectedDaysArray) {
                      const dayWarnings: Array<{
                        type:
                          | "DESIRED_HOURS"
                          | "DIFFICULT_DAY"
                          | "MAX_STAFF"
                          | "UNAVAILABLE";
                        data: any;
                      }> = [];

                      // UNAVAILABLE 체크
                      const availability = getAvailabilityForUserDate(
                        multiDayModalUser.userId,
                        dateStr
                      );
                      if (availability) {
                        dayWarnings.push({
                          type: "UNAVAILABLE",
                          data: {
                            reason: availability.reason,
                          },
                        });
                      }

                      // DIFFICULT_DAY 체크
                      const scheduleDate = new Date(dateStr);
                      const scheduleWeekday = scheduleDate.getDay();
                      const preferredWeekdays =
                        userData.preferredWeekdays || [];
                      const isDifficultDay = preferredWeekdays.some(
                        (pw: { weekday: number; is_preferred: boolean }) =>
                          pw.weekday === scheduleWeekday &&
                          pw.is_preferred === true
                      );

                      if (isDifficultDay) {
                        const weekdayNames = [
                          t("user.weekdays.sunday", locale),
                          t("user.weekdays.monday", locale),
                          t("user.weekdays.tuesday", locale),
                          t("user.weekdays.wednesday", locale),
                          t("user.weekdays.thursday", locale),
                          t("user.weekdays.friday", locale),
                          t("user.weekdays.saturday", locale),
                        ];
                        dayWarnings.push({
                          type: "DIFFICULT_DAY",
                          data: {
                            difficultDayName: weekdayNames[scheduleWeekday],
                            weekday: scheduleWeekday,
                          },
                        });
                      }

                      // MAX_STAFF 체크
                      const scheduleDay = weekDays.find(
                        (day) => format(day, "yyyy-MM-dd") === dateStr
                      );
                      if (scheduleDay) {
                        const {
                          morning: currentMorning,
                          afternoon: currentAfternoon,
                        } = getShiftCounts(scheduleDay);

                        const startMinForShift =
                          parseInt(startTime.split(":")[0]) * 60 +
                          parseInt(startTime.split(":")[1]);
                        const isMorningShift =
                          startMinForShift < shiftBoundaryTimeMin;

                        const newMorningCount = isMorningShift
                          ? currentMorning + 1
                          : currentMorning;
                        const newAfternoonCount = !isMorningShift
                          ? currentAfternoon + 1
                          : currentAfternoon;

                        if (
                          maxMorningStaff > 0 &&
                          newMorningCount > maxMorningStaff
                        ) {
                          dayWarnings.push({
                            type: "MAX_STAFF",
                            data: {
                              shiftType: "morning",
                              currentStaff: currentMorning,
                              maxStaff: maxMorningStaff,
                            },
                          });
                        }

                        if (
                          maxAfternoonStaff > 0 &&
                          newAfternoonCount > maxAfternoonStaff
                        ) {
                          dayWarnings.push({
                            type: "MAX_STAFF",
                            data: {
                              shiftType: "afternoon",
                              currentStaff: currentAfternoon,
                              maxStaff: maxAfternoonStaff,
                            },
                          });
                        }
                      }

                      if (dayWarnings.length > 0) {
                        warnings.push({
                          date: dateStr,
                          warnings: dayWarnings,
                        });
                      }
                    }

                    // DESIRED_HOURS 체크 (모든 선택된 요일의 시간 합산)
                    // desiredWeeklyHours가 없으면 기본값 40으로 설정
                    const desiredHours = userData.desiredWeeklyHours || 40;

                    if (selectedDaysArray.length > 0) {
                      const startMin =
                        parseInt(startTime.split(":")[0]) * 60 +
                        parseInt(startTime.split(":")[1]);
                      let endMin =
                        parseInt(endTime.split(":")[0]) * 60 +
                        parseInt(endTime.split(":")[1]);

                      if (endMin <= startMin) {
                        endMin += 24 * 60;
                      }

                      const workMinutes = endMin - startMin;
                      const unpaidBreakMin =
                        selectedItem?.unpaid_break_min || 0;
                      const newHoursPerDay =
                        Math.round(((workMinutes - unpaidBreakMin) / 60) * 10) /
                        10;

                      // 현재 등록되어 있는 스케줄 시간 포함
                      const currentHours = getUserTotalHours(
                        multiDayModalUser.userId
                      );
                      const totalNewHours =
                        newHoursPerDay * selectedDaysArray.length;
                      const totalHours = currentHours + totalNewHours;

                      if (totalHours > desiredHours) {
                        // 각 요일별로 DESIRED_HOURS 경고 추가
                        selectedDaysArray.forEach((dateStr) => {
                          const existingWarning = warnings.find(
                            (w) => w.date === dateStr
                          );
                          if (existingWarning) {
                            existingWarning.warnings.push({
                              type: "DESIRED_HOURS",
                              data: {
                                currentHours,
                                desiredHours,
                                newHours: newHoursPerDay,
                                totalHours,
                              },
                            });
                          } else {
                            warnings.push({
                              date: dateStr,
                              warnings: [
                                {
                                  type: "DESIRED_HOURS",
                                  data: {
                                    currentHours,
                                    desiredHours,
                                    newHours: newHoursPerDay,
                                    totalHours,
                                  },
                                },
                              ],
                            });
                          }
                        });
                      }
                    }

                    // 경고가 있으면 확인 모달 표시
                    if (warnings.length > 0) {
                      setWarningData({
                        type: "MULTI_DAY",
                        userName: multiDayModalUser.userName,
                        multiDayWarnings: warnings,
                      });
                      setPendingScheduleData({
                        requestData: {
                          multiDay: true,
                          store_id: storeId,
                          user_id: multiDayModalUser.userId,
                          work_item_id: selectedWorkItem,
                          start_time: startTime,
                          end_time: endTime,
                          selectedDays: selectedDaysArray,
                        },
                        existingAssignment: undefined,
                      });
                      setShowWarningDialog(true);
                      setIsModalLoading(false);
                      return;
                    }

                    // 경고가 없으면 바로 일괄 등록
                    const promises = selectedDaysArray.map((dateStr) => {
                      const requestData = {
                        store_id: storeId,
                        user_id: multiDayModalUser.userId,
                        work_item_id: selectedWorkItem,
                        date: dateStr,
                        start_time: startTime,
                        end_time: endTime,
                      };

                      return fetch("/api/schedule/assignments", {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify(requestData),
                      });
                    });

                    const results = await Promise.allSettled(promises);
                    const failed = results.filter(
                      (r) => r.status === "rejected"
                    );

                    if (failed.length > 0) {
                      alert(
                        `${t("schedule.scheduleAddError", locale)}: ${
                          failed.length
                        }개 실패`
                      );
                    } else {
                      if (onScheduleChange) {
                        onScheduleChange();
                      }
                      setIsMultiDayModalOpen(false);
                      setSelectedDays(new Set());
                      setMultiDayWarnings([]);
                      setSelectedWorkItem("");
                    }
                  } catch (error) {
                    console.error("복수 요일 스케줄 등록 오류:", error);
                    alert(t("schedule.scheduleAddError", locale));
                  } finally {
                    setIsModalLoading(false);
                  }
                }}
                disabled={
                  isModalLoading || !selectedWorkItem || selectedDays.size === 0
                }
              >
                {isModalLoading
                  ? t("schedule.processing", locale)
                  : t("schedule.register", locale)}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Copy Week Dialog */}
      <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("schedule.copyWeek", locale)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("schedule.selectWeekToCopy", locale)}</Label>
              <div className="flex items-center gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const prevWeek = subWeeks(currentWeek, 1);
                    setSelectedSourceWeek(prevWeek);
                  }}
                >
                  ←
                </Button>
                <Select
                  value={
                    selectedSourceWeek
                      ? startOfWeek(selectedSourceWeek, { weekStartsOn: 1 })
                          .toISOString()
                          .split("T")[0]
                      : ""
                  }
                  onValueChange={(value) => {
                    setSelectedSourceWeek(new Date(value));
                  }}
                >
                  <SelectTrigger className="flex-1 min-h-[44px]">
                    <SelectValue
                      placeholder={t("schedule.selectWeekToCopy", locale)}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {/* 최근 8주 표시 */}
                    {Array.from({ length: 8 }, (_, i) => {
                      const weekDate = subWeeks(currentWeek, i);
                      const weekStart = startOfWeek(weekDate, {
                        weekStartsOn: 1,
                      });
                      const weekEnd = endOfWeek(weekDate, { weekStartsOn: 1 });
                      const dateLocale = dateLocales[locale];
                      return (
                        <SelectItem
                          key={weekStart.toISOString()}
                          value={weekStart.toISOString().split("T")[0]}
                        >
                          {format(weekStart, "MM/dd", { locale: dateLocale })} -{" "}
                          {format(weekEnd, "MM/dd", { locale: dateLocale })}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const nextWeek = addWeeks(currentWeek, 1);
                    setSelectedSourceWeek(nextWeek);
                  }}
                >
                  →
                </Button>
              </div>
            </div>

            {/* 전주 스케줄 복사 버튼 */}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                const prevWeek = subWeeks(currentWeek, 1);
                setSelectedSourceWeek(prevWeek);
              }}
            >
              {t("schedule.copyPreviousWeek", locale)}
            </Button>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{t("schedule.copyWarning", locale)}</AlertTitle>
              <AlertDescription>
                {t("schedule.copyConfirmDescription", locale)}
              </AlertDescription>
            </Alert>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setCopyDialogOpen(false);
                  setSelectedSourceWeek(null);
                }}
              >
                {t("common.cancel", locale)}
              </Button>
              <Button
                onClick={() => {
                  if (!selectedSourceWeek) {
                    toast({
                      title: t("common.error", locale),
                      description: t("schedule.selectWeekToCopy", locale),
                      variant: "destructive",
                    });
                    return;
                  }
                  setCopyWarningDialogOpen(true);
                }}
                disabled={!selectedSourceWeek || isCopying}
              >
                {t("schedule.copyWeek", locale)}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Copy Warning Dialog */}
      <Dialog
        open={copyWarningDialogOpen}
        onOpenChange={setCopyWarningDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("schedule.copyConfirm", locale)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{t("schedule.copyWarning", locale)}</AlertTitle>
              <AlertDescription>
                {t("schedule.copyConfirmDescription", locale)}
              </AlertDescription>
            </Alert>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setCopyWarningDialogOpen(false);
                }}
              >
                {t("common.cancel", locale)}
              </Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  if (!selectedSourceWeek) return;

                  setIsCopying(true);
                  try {
                    const sourceWeekStart = startOfWeek(selectedSourceWeek, {
                      weekStartsOn: 1,
                    });
                    const targetWeekStart = startOfWeek(currentWeek, {
                      weekStartsOn: 1,
                    });

                    const response = await fetch("/api/schedule/copy-week", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        store_id: storeId,
                        source_week_start: sourceWeekStart
                          .toISOString()
                          .split("T")[0],
                        target_week_start: targetWeekStart
                          .toISOString()
                          .split("T")[0],
                      }),
                    });

                    const result = await response.json();
                    if (result.success) {
                      toast({
                        title: t("schedule.copySuccess", locale),
                        description: t("availability.success", locale),
                      });
                      if (onScheduleChange) {
                        onScheduleChange();
                      }
                      setCopyDialogOpen(false);
                      setCopyWarningDialogOpen(false);
                      setSelectedSourceWeek(null);
                    } else {
                      toast({
                        title: t("common.error", locale),
                        description:
                          result.error || t("schedule.copyError", locale),
                        variant: "destructive",
                      });
                    }
                  } catch (error) {
                    console.error("스케줄 복사 오류:", error);
                    toast({
                      title: t("common.error", locale),
                      description: t("schedule.copyError", locale),
                      variant: "destructive",
                    });
                  } finally {
                    setIsCopying(false);
                  }
                }}
                disabled={isCopying}
              >
                {isCopying
                  ? t("schedule.processing", locale)
                  : t("schedule.copyWeek", locale)}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
