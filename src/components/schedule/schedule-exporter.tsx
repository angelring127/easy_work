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
import { format } from "date-fns";

interface ScheduleExporterProps {
  storeId: string;
  from: string; // ISO date
  to: string; // ISO date
  locale: Locale;
  canExportAll?: boolean; // 관리자 권한
}

export function ScheduleExporter({
  storeId,
  from,
  to,
  locale,
  canExportAll = false,
}: ScheduleExporterProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<"xlsx" | "csv">("xlsx");
  const [exportScope, setExportScope] = useState<"all" | "me">("all");
  const [includePrivateInfo, setIncludePrivateInfo] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  // 엑셀 내보내기 실행
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

  // 빠른 내보내기 (기본 설정)
  const handleQuickExport = async () => {
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
