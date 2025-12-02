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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertCircle } from "lucide-react";
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
  const [businessHours, setBusinessHours] = useState<BusinessHour[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const [canManage, setCanManage] = useState(false);
  const [workItems, setWorkItems] = useState<any[]>([]);
  const [showWorkItemsModal, setShowWorkItemsModal] = useState(false);

  // 週の開始日と終了日を計算
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }); // 月曜日開始
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });

  // 기본 뷰 설정 (주간 뷰)
  useEffect(() => {
    setViewMode("week");
  }, []);

  // データロード
  useEffect(() => {
    if (currentStore?.id) {
      loadScheduleData();
      checkPermissions();
    }
  }, [currentStore?.id, currentWeek]);

  // Work Items가 없고 관리자 권한이 있으면 모달 표시
  // Work Items가 있으면 모달 닫기
  useEffect(() => {
    if (workItems.length === 0 && canManage && currentStore?.id && !loading) {
      setShowWorkItemsModal(true);
    } else if (workItems.length > 0) {
      // Work Items가 있으면 모달 닫기
      setShowWorkItemsModal(false);
    }
  }, [workItems.length, canManage, currentStore?.id, loading]);

  // 페이지 포커스 시 work items 다시 확인
  useEffect(() => {
    const handleFocus = () => {
      if (currentStore?.id && canManage) {
        // work items 다시 확인
        fetch(`/api/work-items?store_id=${currentStore.id}`)
          .then((res) => res.json())
          .then((data) => {
            if (data.success) {
              const items = data.data || [];
              setWorkItems(items);
              if (items.length > 0) {
                setShowWorkItemsModal(false);
              }
            }
          })
          .catch((error) => {
            console.error("Work items 확인 오류:", error);
          });
      }
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [currentStore?.id, canManage]);

  const loadScheduleData = async () => {
    if (!currentStore?.id) return;

    setLoading(true);
    try {
      // 현재 주의 시작일과 종료일 계산 (매번 새로 계산, 로컬 시간대 기준)
      const currentWeekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
      const currentWeekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
      const fromDate = format(currentWeekStart, "yyyy-MM-dd");
      const toDate = format(currentWeekEnd, "yyyy-MM-dd");

      console.log("스케줄 데이터 로드:", {
        currentWeek: format(currentWeek, "yyyy-MM-dd"),
        fromDate,
        toDate,
      });

      // API 호출 구현
      const [assignmentsRes, availabilitiesRes, storeUsersRes, businessHoursRes, workItemsRes] =
        await Promise.all([
          fetch(
            `/api/schedule/assignments?store_id=${currentStore.id}&from=${fromDate}&to=${toDate}`
          ),
          fetch(
            `/api/schedule/availability?store_id=${currentStore.id}&from=${fromDate}&to=${toDate}`
          ),
          fetch(`/api/stores/${currentStore.id}/users`),
          fetch(`/api/store-business-hours?store_id=${currentStore.id}`),
          fetch(`/api/work-items?store_id=${currentStore.id}`),
        ]);

      if (assignmentsRes.ok) {
        const assignmentsData = await assignmentsRes.json();
        const loadedAssignments = assignmentsData.data || [];
        
        // 현재 주 범위 내의 스케줄만 필터링 (안전장치)
        const filteredAssignments = loadedAssignments.filter((a: ScheduleAssignment) => {
          return a.date >= fromDate && a.date <= toDate;
        });
        
        console.log("로드된 스케줄:", {
          total: loadedAssignments.length,
          filtered: filteredAssignments.length,
          dates: filteredAssignments.map((a: ScheduleAssignment) => a.date),
        });
        
        setAssignments(filteredAssignments);
      }

      if (availabilitiesRes.ok) {
        const availabilitiesData = await availabilitiesRes.json();
        setUserAvailabilities(availabilitiesData.data || []);
      }

      if (businessHoursRes.ok) {
        const businessHoursData = await businessHoursRes.json();
        if (businessHoursData.success) {
          setBusinessHours(businessHoursData.data || []);
        }
      }

      // Work Items 확인
      if (workItemsRes.ok) {
        const workItemsData = await workItemsRes.json();
        if (workItemsData.success) {
          const items = workItemsData.data || [];
          setWorkItems(items);
          // Work Items가 있으면 모달 닫기
          if (items.length > 0) {
            setShowWorkItemsModal(false);
          }
        }
      }

      // 매장 사용자 목록도 로드 (사용자 표시를 위해)
      if (storeUsersRes.ok) {
        const storeUsersData = await storeUsersRes.json();
        console.log("매장 사용자 API 응답:", storeUsersData);
        if (storeUsersData.success) {
          const members = storeUsersData.data?.members || [];
          const transformedUsers = members.map((member: any) => ({
            // Guest 사용자의 경우 user_id가 null이므로 id(store_users.id)를 사용
            id: member.id || member.user_id,
            name: member.name || member.email || "Unknown User",
            email: member.email || "",
            roles: [member.role], // 단일 역할을 배열로 변환
            status: member.status,
            deleted_at: member.deleted_at,
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
    // 자동 배정 로직 제거 - 사용자가 수동으로 선택해야 함
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
    const from = format(weekStart, "yyyy-MM-dd");
    const to = format(weekEnd, "yyyy-MM-dd");
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
            from={format(weekStart, "yyyy-MM-dd")}
            to={format(weekEnd, "yyyy-MM-dd")}
            locale={currentLocale}
            canExportAll={canManage}
            assignments={assignments}
            userAvailabilities={userAvailabilities}
            currentWeek={currentWeek}
            storeUsers={storeUsers}
            storeName={currentStore.name}
            businessHours={businessHours}
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
          <TabsTrigger value="week" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {t("schedule.weekView", currentLocale)}
          </TabsTrigger>
          <TabsTrigger value="month" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {t("schedule.monthView", currentLocale)}
          </TabsTrigger>
        </TabsList>

        {
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
              onScheduleChange={loadScheduleData}
              canManage={canManage}
            />
          </TabsContent>
        }

        {
          <TabsContent value="month" className="space-y-4">
            <UserAvailabilityCalendar
              storeId={currentStore.id}
              locale={currentLocale}
              canManage={canManage}
              storeUsers={storeUsers}
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
        }
      </Tabs>

      {/* Work Items 없음 모달 */}
      <Dialog open={showWorkItemsModal} onOpenChange={setShowWorkItemsModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              {t("schedule.noWorkItemsTitle", currentLocale)}
            </DialogTitle>
            <DialogDescription>
              {t("schedule.noWorkItemsDescription", currentLocale)}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              {t("schedule.noWorkItemsMessage", currentLocale)}
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowWorkItemsModal(false)}
            >
              {t("common.cancel", currentLocale)}
            </Button>
            <Button
              onClick={() => {
                if (currentStore?.id) {
                  router.push(
                    `/${locale}/stores/${currentStore.id}/edit?tab=workItems`
                  );
                  setShowWorkItemsModal(false);
                }
              }}
            >
              {t("schedule.goToWorkItems", currentLocale)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
