"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { t, type Locale } from "@/lib/i18n";

export interface AutoAssignUnmetSegment {
  date: string;
  patternId: string;
  patternName: string;
  segmentId: string;
  segmentName: string;
  startMin: number;
  endMin: number;
  requiredHeadcount: number;
  assignedHeadcount: number;
  missingRoleIds: string[];
  missingRoleNames: string[];
}

export interface AutoAssignResult {
  created: number;
  skipped: number;
  warnings: string[];
  unmetSegments: AutoAssignUnmetSegment[];
}

function formatMinutes(minutes: number, locale: Locale): string {
  const localeName = { en: "en-US", ko: "ko-KR", ja: "ja-JP" }[locale];
  const date = new Date(Date.UTC(2026, 0, 1, 0, minutes % 1440));
  return new Intl.DateTimeFormat(localeName, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

export function AutoAssignResultDialog({
  result,
  locale,
  onClose,
}: {
  result: AutoAssignResult | null;
  locale: Locale;
  onClose: () => void;
}) {
  if (!result) {
    return null;
  }

  const hasUnmetSegments = result.unmetSegments.length > 0;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto [&>button]:right-1 [&>button]:top-1 [&>button]:flex [&>button]:h-11 [&>button]:w-11 [&>button]:items-center [&>button]:justify-center sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {hasUnmetSegments ? (
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            )}
            {t("schedule.autoAssignResultTitle", locale)}
          </DialogTitle>
          <DialogDescription>
            {t("schedule.autoAssignResultDescription", locale, {
              created: result.created,
            })}
          </DialogDescription>
        </DialogHeader>

        {hasUnmetSegments ? (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">
              {t("schedule.autoAssignUnmetTitle", locale, {
                count: result.unmetSegments.length,
              })}
            </h3>
            <p className="text-sm text-gray-600">
              {t("schedule.autoAssignUnmetGuidance", locale)}
            </p>
            {result.unmetSegments.map((segment) => (
              <div
                key={`${segment.date}-${segment.segmentId}`}
                className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium text-gray-900">
                    {segment.date} · {segment.segmentName}
                  </p>
                  <p className="text-sm text-gray-600">
                    {formatMinutes(segment.startMin, locale)}-
                    {formatMinutes(segment.endMin, locale)}
                    {segment.endMin === 1440
                      ? ` ${t("autoSchedule.pattern.nextDay", locale)}`
                      : ""}
                  </p>
                </div>
                {segment.assignedHeadcount < segment.requiredHeadcount && (
                  <p className="text-sm text-amber-900">
                    {t("schedule.autoAssignUnmetHeadcount", locale, {
                      assigned: segment.assignedHeadcount,
                      required: segment.requiredHeadcount,
                    })}
                  </p>
                )}
                {segment.missingRoleNames.length > 0 && (
                  <p className="text-sm text-amber-900">
                    {t("schedule.autoAssignMissingRoles", locale, {
                      roles: segment.missingRoleNames.join(", "),
                    })}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-md border bg-green-50 p-3 text-sm text-green-800">
            {t("schedule.autoAssignComplete", locale)}
          </p>
        )}

        <DialogFooter>
          <Button onClick={onClose} className="min-h-11">
            {t("common.close", locale)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
