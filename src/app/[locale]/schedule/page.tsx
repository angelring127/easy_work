"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Calendar,
  Download,
  Filter,
  Users,
  Clock,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { StoreSwitcher } from "@/components/ui/store-switcher";
import { WeekGrid } from "@/components/schedule/week-grid";
import { UserAvailabilityCalendar } from "@/components/schedule/user-availability-calendar";
import { ScheduleExporter } from "@/components/schedule/schedule-exporter";
import { useAuth } from "@/contexts/auth-context";
import { useStore } from "@/contexts/store-context";
import { t, type Locale } from "@/lib/i18n";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from "date-fns";
import { ko, enUS, ja } from "date-fns/locale";

// 日付フォーマット용 로케일 매핑
const dateLocales = { ko, en: enUS, ja };

interface ScheduleAssignment {
  id: string;
  userId: string;
  userName: string;
  workItemId: string;
  workItemName: string;
  date: string;
  startTime: string;
  endTime: string;
  requiredRoles: string[];
  userRoles: string[];
}

interface UserAvailability {
  userId: string;
  userName: string;
  unavailableDates: string[];
  roles: string[];
}

export default function SchedulePage() {
  const { locale } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { currentStore } = useStore();
  const currentLocale = locale as Locale;

  // 状態管理
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [assignments, setAssignments] = useState<ScheduleAssignment[]>([]);
  const [userAvailabilities, setUserAvailabilities] = useState<
    UserAvailability[]
  >([]);
  const [storeUsers, setStoreUsers] = useState<
    Array<{
      id: string;
      name: string;
      email: string;
      roles: string[];
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const [canManage, setCanManage] = useState(false);

  // 週の開始日と終了日を計算
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }); // 月曜日開始
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });

  // 스토어 정책에 따른 초기 뷰 설정
  useEffect(() => {
    if (currentStore?.schedule_unit === "month") {
      setViewMode("month");
    } else {
      setViewMode("week");
    }
  }, [currentStore?.schedule_unit]);

  // データロード
  useEffect(() => {
    if (currentStore?.id) {
      loadScheduleData();
      checkPermissions();
    }
  }, [currentStore?.id, currentWeek]);

  const loadScheduleData = async () => {
    if (!currentStore?.id) return;

    setLoading(true);
    try {
      // API 호출 구현
      const [assignmentsRes, availabilitiesRes, storeUsersRes] =
        await Promise.all([
          fetch(
            `/api/schedule/assignments?store_id=${currentStore.id}&from=${
              weekStart.toISOString().split("T")[0]
            }&to=${weekEnd.toISOString().split("T")[0]}`
          ),
          fetch(
            `/api/schedule/availability?store_id=${currentStore.id}&from=${
              weekStart.toISOString().split("T")[0]
            }&to=${weekEnd.toISOString().split("T")[0]}`
          ),
          fetch(`/api/stores/${currentStore.id}/users`),
        ]);

      if (assignmentsRes.ok) {
        const assignmentsData = await assignmentsRes.json();
        setAssignments(assignmentsData.data || []);
      }

      if (availabilitiesRes.ok) {
        const availabilitiesData = await availabilitiesRes.json();
        setUserAvailabilities(availabilitiesData.data || []);
      }

      // 매장 사용자 목록도 로드 (사용자 표시를 위해)
      if (storeUsersRes.ok) {
        const storeUsersData = await storeUsersRes.json();
        console.log("매장 사용자 API 응답:", storeUsersData);
        if (storeUsersData.success) {
          const members = storeUsersData.data?.members || [];
          const transformedUsers = members.map((member: any) => ({
            id: member.user_id,
            name: member.name || member.email || "Unknown User",
            email: member.email,
            roles: [member.role], // 단일 역할을 배열로 변환
          }));
          console.log("변환된 사용자 목록:", transformedUsers);
          setStoreUsers(transformedUsers);
        }
      } else {
        console.error(
          "매장 사용자 API 오류:",
          storeUsersRes.status,
          storeUsersRes.statusText
        );
      }
    } catch (error) {
      console.error("스케줄 데이터 로드 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkPermissions = async () => {
    if (!currentStore?.id || !user) return;

    try {
      // 사용자 권한 확인 (간단한 구현)
      // 실제로는 API에서 권한 정보를 가져와야 함
      setCanManage(true); // 임시로 true 설정
    } catch (error) {
      console.error("권한 확인 실패:", error);
      setCanManage(false);
    }
  };

  // 週移動
  const goToPreviousWeek = () => {
    setCurrentWeek(subWeeks(currentWeek, 1));
  };

  const goToNextWeek = () => {
    setCurrentWeek(addWeeks(currentWeek, 1));
  };

  const goToCurrentWeek = () => {
    setCurrentWeek(new Date());
  };

  // 이벤트 핸들러들
  const handleAssignmentClick = (assignment: ScheduleAssignment) => {
    console.log("배정 클릭:", assignment);
    // TODO: 배정 상세 보기 또는 편집 다이얼로그 열기
  };

  const handleUserClick = (userId: string, date: string) => {
    console.log("사용자 클릭:", userId, date);
    // 셀 클릭 시 해당 유저/날짜 대상 자동 배정 시도
    if (!currentStore?.id) return;
    const assign = async () => {
      try {
        const res = await fetch(
          `/api/schedule/auto-assign?store_id=${currentStore.id}&from=${date}&to=${date}&user_id=${userId}&date=${date}`,
          { method: "POST" }
        );
        const json = await res.json();
        console.log("cell auto-assign:", json);
        await loadScheduleData();
      } catch (e) {
        console.error("cell auto-assign error", e);
      }
    };
    assign();
  };

  const handleAvailabilityToggle = (
    userId: string,
    date: string,
    isUnavailable: boolean
  ) => {
    console.log("출근 불가 토글:", userId, date, isUnavailable);
    // TODO: 출근 불가 상태 변경 API 호출
  };

  // 日付フォーマット
  const formatDate = (date: Date) => {
    const dateLocale = dateLocales[currentLocale];
    return format(date, "yyyy-MM-dd", { locale: dateLocale });
  };

  const formatWeekRange = () => {
    const dateLocale = dateLocales[currentLocale];
    return `${format(weekStart, "MM/dd", { locale: dateLocale })} - ${format(
      weekEnd,
      "MM/dd",
      { locale: dateLocale }
    )}`;
  };

  const handleAutoAssign = async () => {
    if (!currentStore?.id) return;
    const from = weekStart.toISOString().split("T")[0];
    const to = weekEnd.toISOString().split("T")[0];
    try {
      const res = await fetch(
        `/api/schedule/auto-assign?store_id=${currentStore.id}&from=${from}&to=${to}`,
        { method: "POST" }
      );
      const json = await res.json();
      console.log("auto-assign:", json);
      await loadScheduleData();
    } catch (e) {
      console.error("auto-assign error", e);
    }
  };

  if (!currentStore) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">
              {t("schedule.noStoreSelected", currentLocale)}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* ヘッダー */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/${locale}/dashboard`)}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("common.back", currentLocale)}
          </Button>
          <div>
            <h1 className="text-3xl font-bold">
              {t("schedule.title", currentLocale)}
            </h1>
            <p className="text-muted-foreground">
              {currentStore.name} • {formatWeekRange()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <StoreSwitcher />
          {canManage && (
            <Button variant="default" size="sm" onClick={handleAutoAssign}>
              {t("schedule.autoAssign", currentLocale)}
            </Button>
          )}
          <ScheduleExporter
            storeId={currentStore.id}
            from={weekStart.toISOString().split("T")[0]}
            to={weekEnd.toISOString().split("T")[0]}
            locale={currentLocale}
            canExportAll={canManage}
          />
        </div>
      </div>

      {/* 週ナビゲーション */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={goToPreviousWeek}>
                ←
              </Button>
              <Button variant="outline" size="sm" onClick={goToCurrentWeek}>
                {t("schedule.currentWeek", currentLocale)}
              </Button>
              <Button variant="outline" size="sm" onClick={goToNextWeek}>
                →
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="secondary">{formatWeekRange()}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* メインコンテンツ */}
      <Tabs
        value={viewMode}
        onValueChange={(value) => setViewMode(value as "week" | "month")}
      >
        <TabsList className="grid w-full grid-cols-2">
          {currentStore?.schedule_unit !== "month" && (
            <TabsTrigger value="week" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {t("schedule.weekView", currentLocale)}
            </TabsTrigger>
          )}
          {currentStore?.schedule_unit !== "week" && (
            <TabsTrigger value="month" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {t("schedule.monthView", currentLocale)}
            </TabsTrigger>
          )}
        </TabsList>

        {currentStore?.schedule_unit !== "month" && (
          <TabsContent value="week" className="space-y-4">
            <WeekGrid
              storeId={currentStore.id}
              currentWeek={currentWeek}
              locale={currentLocale}
              assignments={assignments}
              userAvailabilities={userAvailabilities}
              storeUsers={storeUsers}
              onAssignmentClick={handleAssignmentClick}
              onUserClick={handleUserClick}
              onAvailabilityToggle={handleAvailabilityToggle}
              canManage={canManage}
            />
          </TabsContent>
        )}

        {currentStore?.schedule_unit !== "week" && (
          <TabsContent value="month" className="space-y-4">
            <UserAvailabilityCalendar
              storeId={currentStore.id}
              locale={currentLocale}
              canManage={canManage}
              onAvailabilityChange={(date, isUnavailable, reason) => {
                console.log(
                  "출근 불가 상태 변경:",
                  date,
                  isUnavailable,
                  reason
                );
                // 데이터 새로고침
                loadScheduleData();
              }}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
