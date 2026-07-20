"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { OperatingPatternEditor } from "@/components/schedule/operating-pattern-editor";
import { useToast } from "@/hooks/use-toast";
import { t, type Locale } from "@/lib/i18n";
import { findOperatingPatternValidationIssues } from "@/lib/schedule/operating-patterns";
import type { OperatingPatternPayload } from "@/lib/validations/schedule/operating-patterns";

type ConditionKey =
  | "desired_weekly_hours"
  | "day_off_preference"
  | "preferred_weekday";

type ConditionPriority = {
  conditionKey: ConditionKey;
  priorityRank: number;
  weight: number;
};

type UserPriority = {
  userId: string;
  name: string;
  role: string;
  isActive: boolean;
  isGuest: boolean;
  priorityRank: number;
};

type JobRole = {
  id: string;
  name: string;
  code: string;
};

type AutoScheduleSettings = {
  conditionPriorities: ConditionPriority[];
  userPriorities: UserPriority[];
  jobRoles: JobRole[];
  operatingPatterns: OperatingPatternPayload[];
};

const requiredConditionKeys = [
  "autoSchedule.required.weeklyMax",
  "autoSchedule.required.monthlyMax",
  "autoSchedule.required.unavailable",
  "autoSchedule.required.branchConflict",
  "autoSchedule.required.missingRole",
  "autoSchedule.required.staffLimit",
  "autoSchedule.required.coverageGap",
] as const;

const conditionLabelKeys: Record<ConditionKey, string> = {
  desired_weekly_hours: "autoSchedule.condition.desiredWeeklyHours",
  day_off_preference: "autoSchedule.condition.dayOffPreference",
  preferred_weekday: "autoSchedule.condition.preferredWeekday",
};

function reorderByIndex<T>(items: T[], fromIndex: number, toIndex: number) {
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

function rankConditionPriorities(items: ConditionPriority[]) {
  return items.map((item, index) => ({
    ...item,
    priorityRank: index + 1,
    weight: [30, 20, 10][index] || item.weight,
  }));
}

function rankUserPriorities(items: UserPriority[]) {
  return items.map((item, index) => ({ ...item, priorityRank: index + 1 }));
}

export function AutoScheduleSettingsEditor({
  storeId,
  locale,
}: {
  storeId: string;
  locale: Locale;
}) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<AutoScheduleSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [draggedConditionIndex, setDraggedConditionIndex] = useState<
    number | null
  >(null);
  const [draggedUserIndex, setDraggedUserIndex] = useState<number | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/stores/${storeId}/auto-schedule-settings`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to load auto schedule settings");
      }
      setSettings(json.data);
    } catch (error) {
      console.error("자동 스케줄 설정 로드 오류:", error);
      toast({
        title: t("common.error", locale),
        description: t("autoSchedule.loadError", locale),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [storeId, locale, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const moveCondition = (fromIndex: number, toIndex: number) => {
    setSettings((current) => {
      if (!current || toIndex < 0 || toIndex >= current.conditionPriorities.length) {
        return current;
      }
      return {
        ...current,
        conditionPriorities: rankConditionPriorities(
          reorderByIndex(current.conditionPriorities, fromIndex, toIndex)
        ),
      };
    });
  };

  const moveUser = (fromIndex: number, toIndex: number) => {
    setSettings((current) => {
      if (!current || toIndex < 0 || toIndex >= current.userPriorities.length) {
        return current;
      }
      return {
        ...current,
        userPriorities: rankUserPriorities(
          reorderByIndex(current.userPriorities, fromIndex, toIndex)
        ),
      };
    });
  };

  const save = async () => {
    if (!settings) {
      return;
    }

    const blockingPatternIssues = findOperatingPatternValidationIssues(
      settings.operatingPatterns
    ).filter((issue) => issue.severity === "error");
    if (blockingPatternIssues.length > 0) {
      toast({
        title: t("common.error", locale),
        description: t("autoSchedule.pattern.fixErrors", locale),
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/stores/${storeId}/auto-schedule-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conditionPriorities: settings.conditionPriorities,
          userPriorities: settings.userPriorities.map((priority) => ({
            userId: priority.userId,
            priorityRank: priority.priorityRank,
          })),
          operatingPatterns: settings.operatingPatterns,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to save auto schedule settings");
      }

      toast({ title: t("autoSchedule.saveSuccess", locale) });
      await load();
    } catch (error) {
      console.error("자동 스케줄 설정 저장 오류:", error);
      toast({
        title: t("common.error", locale),
        description: t("autoSchedule.saveError", locale),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <p>{t("common.loading", locale)}...</p>;
  }

  if (!settings) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-gray-600">
            {t("autoSchedule.loadError", locale)}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">
          {t("autoSchedule.title", locale)}
        </h3>
        <p className="mt-1 break-keep text-sm text-gray-600">
          {t("autoSchedule.description", locale)}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("autoSchedule.conditionPriorities", locale)}
          </CardTitle>
          <CardDescription className="break-keep">
            {t("autoSchedule.conditionPrioritiesDescription", locale)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {settings.conditionPriorities.map((priority, index) => (
              <div
                key={priority.conditionKey}
                draggable
                onDragStart={() => setDraggedConditionIndex(index)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (draggedConditionIndex !== null) {
                    moveCondition(draggedConditionIndex, index);
                  }
                  setDraggedConditionIndex(null);
                }}
                className="flex items-center gap-3 rounded-md border bg-white p-3"
              >
                <GripVertical className="h-4 w-4 text-gray-400" />
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-700">
                  {priority.priorityRank}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900">
                    {t(conditionLabelKeys[priority.conditionKey], locale)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {priority.weight}
                    {t("autoSchedule.points", locale)}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => moveCondition(index, index - 1)}
                    disabled={index === 0}
                    aria-label={t("autoSchedule.moveUp", locale)}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => moveCondition(index, index + 1)}
                    disabled={index === settings.conditionPriorities.length - 1}
                    aria-label={t("autoSchedule.moveDown", locale)}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-md border bg-gray-50 p-4">
            <h4 className="text-sm font-semibold text-gray-900">
              {t("autoSchedule.requiredConditions", locale)}
            </h4>
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
              {requiredConditionKeys.map((key) => (
                <div key={key} className="text-sm text-gray-600">
                  {t(key, locale)}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <OperatingPatternEditor
        patterns={settings.operatingPatterns}
        jobRoles={settings.jobRoles}
        locale={locale}
        onChange={(operatingPatterns) =>
          setSettings((current) =>
            current ? { ...current, operatingPatterns } : current
          )
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("autoSchedule.userPriorities", locale)}
          </CardTitle>
          <CardDescription className="break-keep">
            {t("autoSchedule.userPrioritiesDescription", locale)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {settings.userPriorities.length === 0 ? (
            <p className="break-keep text-sm text-gray-600">
              {t("autoSchedule.noMembers", locale)}
            </p>
          ) : (
            <div className="space-y-2">
              {settings.userPriorities.map((priority, index) => (
                <div
                  key={priority.userId}
                  draggable
                  onDragStart={() => setDraggedUserIndex(index)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (draggedUserIndex !== null) {
                      moveUser(draggedUserIndex, index);
                    }
                    setDraggedUserIndex(null);
                  }}
                  className="flex items-center gap-3 rounded-md border bg-white p-3"
                >
                  <GripVertical className="h-4 w-4 text-gray-400" />
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-700">
                    {priority.priorityRank}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900">
                      {priority.name}
                    </p>
                    <p className="text-xs text-gray-500">{priority.role}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => moveUser(index, index - 1)}
                      disabled={index === 0}
                      aria-label={t("autoSchedule.moveUp", locale)}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => moveUser(index, index + 1)}
                      disabled={index === settings.userPriorities.length - 1}
                      aria-label={t("autoSchedule.moveDown", locale)}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={isSaving}>
          {isSaving ? t("schedule.processing", locale) : t("common.save", locale)}
        </Button>
      </div>
    </section>
  );
}
