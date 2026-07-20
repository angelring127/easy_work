"use client";

import { Plus, Trash2 } from "lucide-react";

import {
  OperatingPatternSegmentEditor,
  type OperatingPatternJobRole,
} from "@/components/schedule/operating-pattern-segment-editor";
import { OperatingPatternWeekdaySelector } from "@/components/schedule/operating-pattern-weekday-selector";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { t, type Locale } from "@/lib/i18n";
import { findOperatingPatternValidationIssues } from "@/lib/schedule/operating-patterns";
import type { OperatingPatternPayload } from "@/lib/validations/schedule/operating-patterns";

const issueKeys = {
  DUPLICATE_WEEKDAY: "autoSchedule.pattern.issue.duplicateWeekday",
  EMPTY_PATTERN_NAME: "autoSchedule.pattern.issue.emptyPatternName",
  EMPTY_SEGMENT_NAME: "autoSchedule.pattern.issue.emptySegmentName",
  INVALID_SEGMENT_TIME: "autoSchedule.pattern.issue.invalidTime",
  INVALID_MIN_HEADCOUNT: "autoSchedule.pattern.issue.invalidHeadcount",
  OVERLAPPING_SEGMENTS: "autoSchedule.pattern.issue.overlap",
  SEGMENT_GAP: "autoSchedule.pattern.issue.gap",
  MISSING_REQUIRED_ROLES: "autoSchedule.pattern.issue.noRoles",
} as const;

function createSegment(sortOrder: number) {
  return {
    id: crypto.randomUUID(),
    name: "",
    startMin: 600,
    endMin: 660,
    minHeadcount: 1,
    sortOrder,
    requiredRoleIds: [],
  };
}

function createPattern(sortOrder: number): OperatingPatternPayload {
  return {
    id: crypto.randomUUID(),
    name: "",
    isActive: true,
    sortOrder,
    weekdays: [],
    segments: [createSegment(1)],
  };
}

export function OperatingPatternEditor({
  patterns,
  jobRoles,
  locale,
  onChange,
}: {
  patterns: OperatingPatternPayload[];
  jobRoles: OperatingPatternJobRole[];
  locale: Locale;
  onChange: (patterns: OperatingPatternPayload[]) => void;
}) {
  const issues = findOperatingPatternValidationIssues(patterns);
  const assignedWeekdays = new Map<number, string>();
  patterns
    .filter((pattern) => pattern.isActive)
    .forEach((pattern) =>
      pattern.weekdays.forEach((weekday) =>
        assignedWeekdays.set(weekday, pattern.id)
      )
    );

  const updatePattern = (
    patternId: string,
    update: (pattern: OperatingPatternPayload) => OperatingPatternPayload
  ) => onChange(patterns.map((item) => (item.id === patternId ? update(item) : item)));

  const removePattern = (patternId: string) =>
    onChange(
      patterns
        .filter((pattern) => pattern.id !== patternId)
        .map((pattern, index) => ({ ...pattern, sortOrder: index + 1 }))
    );

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-base font-semibold text-gray-900">
            {t("autoSchedule.pattern.title", locale)}
          </h4>
          <p className="mt-1 break-keep text-sm text-gray-600">
            {t("autoSchedule.pattern.description", locale)}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => onChange([...patterns, createPattern(patterns.length + 1)])}
        >
          <Plus className="mr-2 h-4 w-4" />
          {t("autoSchedule.pattern.add", locale)}
        </Button>
      </div>

      {patterns.length === 0 ? (
        <div className="break-keep rounded-md border border-dashed p-6 text-center text-sm text-gray-600">
          {t("autoSchedule.pattern.empty", locale)}
        </div>
      ) : (
        patterns.map((pattern) => {
          const patternIssues = issues.filter(
            (issue) => issue.patternId === pattern.id
          );
          return (
            <Card key={pattern.id}>
              <CardHeader className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <CardTitle className="min-w-0 flex-1 text-base">
                    {pattern.name || t("autoSchedule.pattern.untitled", locale)}
                  </CardTitle>
                  <Switch
                    checked={pattern.isActive}
                    onCheckedChange={(isActive) =>
                      updatePattern(pattern.id, (current) => ({
                        ...current,
                        isActive,
                      }))
                    }
                    aria-label={t("autoSchedule.pattern.active", locale)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removePattern(pattern.id)}
                    aria-label={t("autoSchedule.pattern.remove", locale)}
                    title={t("autoSchedule.pattern.remove", locale)}
                    className="h-11 w-11"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`pattern-name-${pattern.id}`}>
                    {t("autoSchedule.pattern.name", locale)}
                  </Label>
                  <Input
                    id={`pattern-name-${pattern.id}`}
                    value={pattern.name}
                    onChange={(event) =>
                      updatePattern(pattern.id, (current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                  />
                </div>
                <OperatingPatternWeekdaySelector
                  selectedWeekdays={pattern.weekdays}
                  disabledWeekdays={
                    new Set(
                      [...assignedWeekdays.entries()]
                        .filter(
                          ([, owner]) =>
                            pattern.isActive && owner !== pattern.id
                        )
                        .map(([weekday]) => weekday)
                    )
                  }
                  locale={locale}
                  onChange={(weekdays) =>
                    updatePattern(pattern.id, (current) => ({
                      ...current,
                      weekdays,
                    }))
                  }
                />
              </CardHeader>
              <CardContent className="space-y-4">
                {patternIssues.length > 0 && (
                  <div className="space-y-1" role="status">
                    {patternIssues.map((issue, index) => (
                      <p
                        key={`${issue.code}-${issue.segmentId || index}`}
                        className={
                          issue.severity === "error"
                            ? "text-sm text-red-700"
                            : "text-sm text-amber-700"
                        }
                      >
                        {t(issueKeys[issue.code], locale)}
                      </p>
                    ))}
                  </div>
                )}
                {pattern.segments.map((segment, index) => (
                  <OperatingPatternSegmentEditor
                    key={segment.id}
                    segment={segment}
                    jobRoles={jobRoles}
                    locale={locale}
                    onChange={(nextSegment) =>
                      updatePattern(pattern.id, (current) => ({
                        ...current,
                        segments: current.segments.map((item) =>
                          item.id === segment.id ? nextSegment : item
                        ),
                      }))
                    }
                    onRemove={() =>
                      updatePattern(pattern.id, (current) => ({
                        ...current,
                        segments: current.segments
                          .filter((item) => item.id !== segment.id)
                          .map((item, segmentIndex) => ({
                            ...item,
                            sortOrder: segmentIndex + 1,
                          })),
                      }))
                    }
                  />
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    updatePattern(pattern.id, (current) => ({
                      ...current,
                      segments: [
                        ...current.segments,
                        createSegment(current.segments.length + 1),
                      ],
                    }))
                  }
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {t("autoSchedule.pattern.addSegment", locale)}
                </Button>
              </CardContent>
            </Card>
          );
        })
      )}
    </section>
  );
}
