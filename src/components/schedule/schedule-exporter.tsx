"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, FileText, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { t, type Locale } from "@/lib/i18n";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from "date-fns";
import { ko, enUS, ja } from "date-fns/locale";
import ExcelJS from "exceljs";

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

interface StoreUser {
  id: string;
  name: string;
  email: string;
  roles: string[];
  status?: string;
  deleted_at?: string | null;
}

interface BusinessHour {
  id: string;
  store_id: string;
  weekday: number;
  open_min: number;
  close_min: number;
}

interface ScheduleExporterProps {
  storeId: string;
  from: string; // ISO date
  to: string; // ISO date
  locale: Locale;
  canExportAll?: boolean; // 관리자 권한
  // Week Grid 데이터 (현재 표시중인 데이터)
  assignments?: ScheduleAssignment[];
  userAvailabilities?: UserAvailability[];
  currentWeek?: Date;
  storeUsers?: StoreUser[]; // 모든 매장 사용자 (스케줄 없는 유저 포함)
  storeName?: string; // 매장 이름
  businessHours?: BusinessHour[]; // 영업 시간 정보
}

export function ScheduleExporter({
  storeId,
  from,
  to,
  locale,
  canExportAll = false,
  assignments = [],
  userAvailabilities = [],
  currentWeek,
  storeUsers = [],
  storeName = "",
  businessHours = [],
}: ScheduleExporterProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<"xlsx" | "csv">("xlsx");
  const [exportScope, setExportScope] = useState<"all" | "me">("all");
  const [includePrivateInfo, setIncludePrivateInfo] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  // 현재 Week Grid를 Excel로 export (이미지 포맷 적용)
  const handleExportWeekGrid = async () => {
    if (!currentWeek) {
      toast({
        title: t("common.error", locale),
        description: "No data to export",
        variant: "destructive",
      });
      return;
    }

    try {
      setExporting(true);

      // 주간 날짜 범위 계산
      const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
      const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
      const dateLocale = dateLocales[locale] || enUS;

      // ExcelJS 워크북 생성
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Weekly Schedule");

      // 중앙 정렬 스타일 정의
      const centerAlignStyle: Partial<ExcelJS.Style> = {
        alignment: {
          horizontal: "center",
          vertical: "middle",
        },
      };

      // 1. 헤더 행 (날짜)
      const dateRow = worksheet.addRow([storeName || "Schedule", ...weekDays.map((day) => format(day, "d", { locale: dateLocale }))]);
      dateRow.eachCell((cell) => {
        cell.style = centerAlignStyle;
        cell.font = { bold: true };
      });

      // 2. 헤더 행 (요일)
      const dayRow = worksheet.addRow(["", ...weekDays.map((day) => format(day, "EEE", { locale: dateLocale }).toUpperCase())]);
      dayRow.eachCell((cell) => {
        cell.style = centerAlignStyle;
        cell.font = { bold: true };
      });

      // 스토어 이름 셀 병합 (날짜 행과 요일 행)
      worksheet.mergeCells(dateRow.number, 1, dayRow.number, 1);
      dateRow.getCell(1).style = centerAlignStyle;
      dateRow.getCell(1).font = { bold: true };

      // 3. AM Counts Row
      const shiftBoundaryTimeMin = 720; // 12:00 PM
      const amRow = worksheet.addRow([
        "AM",
        ...weekDays.map((day) => {
          const dayStr = format(day, "yyyy-MM-dd");
          const dayAssignments = assignments.filter(
            (a) => a.date === dayStr && a.status === "ASSIGNED"
          );
          let count = 0;
          dayAssignments.forEach((a) => {
            const startMin =
              parseInt(a.startTime.split(":")[0]) * 60 +
              parseInt(a.startTime.split(":")[1]);
            if (startMin < shiftBoundaryTimeMin) count++;
          });
          return count.toString();
        }),
      ]);
      amRow.eachCell((cell) => {
        cell.style = centerAlignStyle;
      });

      // 4. PM Counts Row
      const pmRow = worksheet.addRow([
        "PM",
        ...weekDays.map((day) => {
          const dayStr = format(day, "yyyy-MM-dd");
          const dayAssignments = assignments.filter(
            (a) => a.date === dayStr && a.status === "ASSIGNED"
          );
          let count = 0;
          dayAssignments.forEach((a) => {
            const endMin =
              parseInt(a.endTime.split(":")[0]) * 60 +
              parseInt(a.endTime.split(":")[1]);
            if (endMin > shiftBoundaryTimeMin) count++;
          });
          return count.toString();
        }),
      ]);
      pmRow.eachCell((cell) => {
        cell.style = centerAlignStyle;
      });

      // 사용자 데이터 준비 (Week Grid와 동일한 순서)
      const allUserIds = new Set([
        ...storeUsers.map((u) => u.id),
        ...assignments.map((a) => a.userId),
        ...userAvailabilities.map((a) => a.userId),
      ]);

      const users = Array.from(allUserIds)
        .map((userId) => {
          const storeUser = storeUsers.find((u) => u.id === userId);
          if (storeUser) {
            if (storeUser.status === "INACTIVE" || storeUser.deleted_at) {
              return null;
            }
            return {
              id: userId,
              name: storeUser.name || "",
            };
          }

          const assignment = assignments.find((a) => a.userId === userId);
          const availability = userAvailabilities.find((a) => a.userId === userId);
          const userName = assignment?.userName || availability?.userName || "";

          if (!userName || userName === "Unknown User") {
            return null;
          }

          return {
            id: userId,
            name: userName,
          };
        })
        .filter((user) => user !== null)
        .sort((a, b) => a.name.localeCompare(b.name)) as Array<{
        id: string;
        name: string;
      }>;

      const sortedUserIds = users.map((user) => user.id);

      // 5. User Rows (3 rows per user: name row with start time, start time row, end time row)
      sortedUserIds.forEach((userId) => {
        const gridName = users.find((u) => u.id === userId)?.name?.trim() || "";
        const userName =
          !gridName || gridName === "Unknown User" ? userId : gridName;
        
        // Row 1: User Name with Start Time (will be merged across 3 rows)
        const nameRowData: any[] = [userName];
        // Row 2: Start Time Row (empty for display consistency)
        const startRowData: any[] = [""];
        // Row 3: End Time Row
        const endRowData: any[] = [""];

        weekDays.forEach((day) => {
          const dayStr = format(day, "yyyy-MM-dd");
          const dayOfWeek = day.getDay(); // 0=Sun, 1=Mon...
          
          // Find Assignment
          const userAssignment = assignments.find(
            (a) => a.userId === userId && a.date === dayStr && a.status === "ASSIGNED"
          );

          // Find Availability
          const availability = userAvailabilities.find(
            (ua) => ua.userId === userId && ua.date === dayStr
          );

          // Find Business Hours for this day
          const dayBusinessHour = businessHours.find(h => h.weekday === dayOfWeek);
          const closeMin = dayBusinessHour?.close_min || 0;
          
          if (userAssignment) {
            // Working - Start time goes to first row (nameRowData)
            const startTime = userAssignment.startTime.substring(0, 5); // HH:mm
            nameRowData.push(startTime);
            startRowData.push("");
            
            // Check if end time is close time
            const endMin = 
              parseInt(userAssignment.endTime.split(":")[0]) * 60 + 
              parseInt(userAssignment.endTime.split(":")[1]);
            
            const effectiveCloseMin = closeMin === 0 ? 1440 : closeMin;
            const effectiveEndMin = endMin === 0 ? 1440 : endMin;

            if (effectiveEndMin >= effectiveCloseMin && effectiveCloseMin > 0) {
               endRowData.push("close");
            } else {
               const endTime = userAssignment.endTime.substring(0, 5); // HH:mm
               endRowData.push(endTime);
            }
          } else if (availability) {
            // Unavailable - Merge "X" across 3 rows (only if no assignment)
            nameRowData.push("X");
            startRowData.push("");
            endRowData.push("");
          } else {
            // Empty
            nameRowData.push("");
            startRowData.push("");
            endRowData.push("");
          }
        });

        const nameRow = worksheet.addRow(nameRowData);
        const startRow = worksheet.addRow(startRowData);
        const endRow = worksheet.addRow(endRowData);

        // 사용자 이름 셀 병합 (3줄) - 항상 3줄로 병합
        worksheet.mergeCells(nameRow.number, 1, endRow.number, 1);
        nameRow.getCell(1).style = centerAlignStyle;
        nameRow.getCell(1).font = { bold: true };

        // 모든 셀에 중앙 정렬 적용
        nameRow.eachCell((cell, colNumber) => {
          if (colNumber > 1) cell.style = centerAlignStyle;
        });
        startRow.eachCell((cell, colNumber) => {
          if (colNumber > 1) cell.style = centerAlignStyle;
        });
        endRow.eachCell((cell, colNumber) => {
          if (colNumber > 1) cell.style = centerAlignStyle;
        });

        // Unavailable "X" 셀 병합 (해당 날짜 열에서만, 스케줄이 없는 경우)
        weekDays.forEach((day, dayIndex) => {
          const dayStr = format(day, "yyyy-MM-dd");
          const userAssignment = assignments.find(
            (a) => a.userId === userId && a.date === dayStr && a.status === "ASSIGNED"
          );
          const availability = userAvailabilities.find(
            (ua) => ua.userId === userId && ua.date === dayStr
          );
          // 스케줄이 없고 Unavailable인 경우에만 병합
          if (availability && !userAssignment) {
            const colNumber = dayIndex + 2; // +2 because column 1 is user name
            worksheet.mergeCells(nameRow.number, colNumber, endRow.number, colNumber);
            nameRow.getCell(colNumber).style = centerAlignStyle;
          }
        });
      });

      // 열 너비 조정
      worksheet.getColumn(1).width = 15; // 사용자 이름 열
      // 모든 날짜 열 너비 설정
      for (let i = 2; i <= weekDays.length + 1; i++) {
        worksheet.getColumn(i).width = 12;
      }

      // 행 높이 조정
      worksheet.getRow(1).height = 25; // Date
      worksheet.getRow(2).height = 25; // Day
      worksheet.getRow(3).height = 20; // AM
      worksheet.getRow(4).height = 20; // PM
      // User rows (3 rows per user)
      let rowNumber = 5;
      sortedUserIds.forEach(() => {
        worksheet.getRow(rowNumber++).height = 20; // Name
        worksheet.getRow(rowNumber++).height = 20; // Start
        worksheet.getRow(rowNumber++).height = 20; // End
      });

      // 파일 다운로드
      const fileName = `${storeName ? storeName.replace(/\s+/g, "_") + "_" : ""}schedule_${format(weekStart, "yyyy-MM-dd", { locale: dateLocale })}_to_${format(weekEnd, "yyyy-MM-dd", { locale: dateLocale })}.xlsx`;
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: t("export.success", locale),
        description: t("export.fileDownloaded", locale),
      });
    } catch (error) {
      console.error("Week Grid export 오류:", error);
      toast({
        title: t("export.error", locale),
        description: error instanceof Error ? error.message : "Export failed",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  // 엑셀 내보내기 실행 (Server API)
  const handleExport = async () => {
    if (!storeId) {
      toast({
        title: t("common.error", locale),
        description: "Store ID is required",
        variant: "destructive",
      });
      return;
    }

    setExporting(true);
    try {
      const params = new URLSearchParams({
        store_id: storeId,
        from,
        to,
        format: exportFormat,
        scope: exportScope,
        include_private_info: includePrivateInfo.toString(),
      });

      const response = await fetch(`/api/schedule/export?${params}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Export failed");
      }

      // 파일 다운로드
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      // 파일명 생성
      const fileName = `workeasy_${format(
        new Date(from),
        "yyyy-MM-dd"
      )}_to_${format(new Date(to), "yyyy-MM-dd")}.${exportFormat}`;
      a.download = fileName;

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: t("export.success", locale),
        description: t("export.fileDownloaded", locale),
      });

      setDialogOpen(false);
    } catch (error) {
      console.error("엑셀 내보내기 오류:", error);
      toast({
        title: t("export.error", locale),
        description: error instanceof Error ? error.message : "Export failed",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  // 빠른 내보내기 (현재 Week Grid)
  const handleQuickExport = async () => {
    // Week Grid 데이터가 있으면 현재 Week Grid를 export (이미지 포맷)
    if (currentWeek && assignments.length > 0) {
      handleExportWeekGrid();
      return;
    }
    
    // 그렇지 않으면 기존 API 방식 사용
    setExportFormat("xlsx");
    setExportScope(canExportAll ? "all" : "me");
    setIncludePrivateInfo(false);
    await handleExport();
  };

  return (
    <div className="flex items-center gap-2">
      {/* 빠른 내보내기 버튼 */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleQuickExport}
        disabled={exporting}
        className="flex items-center gap-2"
      >
        <Download className="h-4 w-4" />
        {t("schedule.export", locale)}
      </Button>

      {/* 고급 내보내기 다이얼로그 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={exporting}
            className="flex items-center gap-2"
          >
            <Settings className="h-4 w-4" />
            {t("export.advanced", locale)}
          </Button>
        </DialogTrigger>

        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              {t("export.title", locale)}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* 파일 형식 선택 */}
            <div className="space-y-2">
              <Label htmlFor="format">{t("export.format", locale)}</Label>
              <Select
                value={exportFormat}
                onValueChange={(value: "xlsx" | "csv") =>
                  setExportFormat(value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="xlsx">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4" />
                      {t("export.xlsx", locale)}
                    </div>
                  </SelectItem>
                  <SelectItem value="csv">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      {t("export.csv", locale)}
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 내보내기 범위 */}
            <div className="space-y-2">
              <Label htmlFor="scope">{t("export.scope", locale)}</Label>
              <Select
                value={exportScope}
                onValueChange={(value: "all" | "me") => setExportScope(value)}
                disabled={!canExportAll}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("export.scopeAll", locale)}
                  </SelectItem>
                  <SelectItem value="me">
                    {t("export.scopeMe", locale)}
                  </SelectItem>
                </SelectContent>
              </Select>
              {!canExportAll && (
                <p className="text-sm text-muted-foreground">
                  {t("export.scopeMeOnly", locale)}
                </p>
              )}
            </div>

            {/* 개인정보 포함 옵션 */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="private-info">
                  {t("export.includePrivateInfo", locale)}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("export.includePrivateInfoDescription", locale)}
                </p>
              </div>
              <Switch
                id="private-info"
                checked={includePrivateInfo}
                onCheckedChange={setIncludePrivateInfo}
              />
            </div>

            {/* 내보내기 정보 요약 */}
            <Card>
              <CardContent className="p-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t("export.period", locale)}:
                    </span>
                    <span>
                      {format(new Date(from), "yyyy-MM-dd")} ~{" "}
                      {format(new Date(to), "yyyy-MM-dd")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t("export.format", locale)}:
                    </span>
                    <span>{exportFormat.toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t("export.scope", locale)}:
                    </span>
                    <span>
                      {exportScope === "all"
                        ? t("export.scopeAll", locale)
                        : t("export.scopeMe", locale)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 액션 버튼 */}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={exporting}
              >
                {t("common.cancel", locale)}
              </Button>
              <Button
                onClick={handleExport}
                disabled={exporting}
                className="flex items-center gap-2"
              >
                {exporting ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    {t("export.exporting", locale)}
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    {t("export.download", locale)}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
