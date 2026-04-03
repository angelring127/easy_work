"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { t, type Locale } from "@/lib/i18n";

interface UserDetail {
  id: string;
  jobRoles: Array<{
    id: string;
    store_job_roles: {
      id: string;
      name: string;
      code: string;
      description: string;
      active: boolean;
    };
  }>;
  resignationDate: string | null;
  desiredWeeklyHours: number | null;
  preferredWeekdays: Array<{
    weekday: number;
    is_preferred: boolean;
  }>;
}

interface StoreJobRole {
  id: string;
  name: string;
  code: string;
  description: string;
  active: boolean;
}

interface WeekdayPayloadItem {
  weekday: number;
  isPreferred: boolean;
}

export interface UserWorkPreferencesSaveSummary {
  userId: string;
  jobRoleIds: string[];
  resignationDate: string | null;
  desiredWeeklyHours: number | null;
  preferredWeekdays: Array<{
    weekday: number;
    is_preferred: boolean;
  }>;
}

interface UserWorkPreferencesEditorProps {
  storeId: string;
  userId: string;
  locale: Locale;
  mode: "page" | "modal";
  onSaved?: (summary: UserWorkPreferencesSaveSummary) => void;
  onClose?: () => void;
}

const compareStringArrays = (left: string[], right: string[]) => {
  if (left.length !== right.length) {
    return false;
  }

  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();

  return sortedLeft.every((value, index) => value === sortedRight[index]);
};

const normalizeWeekdayRows = (
  rows: Array<{ weekday: number; is_preferred: boolean }>
) =>
  [...rows]
    .map((row) => ({
      weekday: row.weekday,
      is_preferred: row.is_preferred,
    }))
    .sort(
      (left, right) =>
        left.weekday - right.weekday ||
        Number(left.is_preferred) - Number(right.is_preferred)
    );

const compareWeekdayRows = (
  left: Array<{ weekday: number; is_preferred: boolean }>,
  right: Array<{ weekday: number; is_preferred: boolean }>
) => {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((row, index) => {
    const target = right[index];
    return (
      row.weekday === target.weekday &&
      row.is_preferred === target.is_preferred
    );
  });
};

const buildWeekdayPayload = (
  difficultWeekdays: Set<number>,
  preservedPreferredWeekdays: Set<number>
): WeekdayPayloadItem[] => {
  const difficultRows = Array.from(difficultWeekdays)
    .sort((left, right) => left - right)
    .map((weekday) => ({
      weekday,
      isPreferred: true,
    }));
  const preferredRows = Array.from(preservedPreferredWeekdays)
    .filter((weekday) => !difficultWeekdays.has(weekday))
    .sort((left, right) => left - right)
    .map((weekday) => ({
      weekday,
      isPreferred: false,
    }));

  return [...difficultRows, ...preferredRows].sort(
    (left, right) =>
      left.weekday - right.weekday ||
      Number(left.isPreferred) - Number(right.isPreferred)
  );
};

export function UserWorkPreferencesEditor({
  storeId,
  userId,
  locale,
  mode,
  onSaved,
  onClose,
}: UserWorkPreferencesEditorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [jobRoleIds, setJobRoleIds] = useState<string[]>([]);
  const [resignationDate, setResignationDate] = useState("");
  const [desiredWeeklyHours, setDesiredWeeklyHours] = useState("");
  const [difficultWeekdays, setDifficultWeekdays] = useState<Set<number>>(
    new Set()
  );
  const [preservedPreferredWeekdays, setPreservedPreferredWeekdays] = useState<
    Set<number>
  >(new Set());

  const {
    data: userDetail,
    isLoading: userDetailLoading,
    error: userDetailError,
  } = useQuery({
    queryKey: ["user-detail", storeId, userId],
    queryFn: async () => {
      const response = await fetch(`/api/stores/${storeId}/users/${userId}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data as UserDetail;
    },
    enabled: !!storeId && !!userId,
  });

  const { data: availableJobRoles, isLoading: jobRolesLoading } = useQuery({
    queryKey: ["store-job-roles", storeId],
    queryFn: async () => {
      const response = await fetch(`/api/store-job-roles?store_id=${storeId}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data as StoreJobRole[];
    },
    enabled: !!storeId,
  });

  const activeJobRoles = useMemo(
    () => availableJobRoles?.filter((role) => role.active) || [],
    [availableJobRoles]
  );

  useEffect(() => {
    if (!userDetail) {
      return;
    }

    setJobRoleIds(userDetail.jobRoles.map((jobRole) => jobRole.store_job_roles.id));
    setResignationDate(userDetail.resignationDate || "");
    setDesiredWeeklyHours(userDetail.desiredWeeklyHours?.toString() || "");
    setDifficultWeekdays(
      new Set(
        userDetail.preferredWeekdays
          .filter((weekday) => weekday.is_preferred)
          .map((weekday) => weekday.weekday)
      )
    );
    setPreservedPreferredWeekdays(
      new Set(
        userDetail.preferredWeekdays
          .filter((weekday) => !weekday.is_preferred)
          .map((weekday) => weekday.weekday)
      )
    );
  }, [userDetail]);

  const weekdayOptions = useMemo(
    () => [
      { weekday: 0, label: t("user.weekdays.sunday", locale) },
      { weekday: 1, label: t("user.weekdays.monday", locale) },
      { weekday: 2, label: t("user.weekdays.tuesday", locale) },
      { weekday: 3, label: t("user.weekdays.wednesday", locale) },
      { weekday: 4, label: t("user.weekdays.thursday", locale) },
      { weekday: 5, label: t("user.weekdays.friday", locale) },
      { weekday: 6, label: t("user.weekdays.saturday", locale) },
    ],
    [locale]
  );

  const currentJobRoleIds = userDetail?.jobRoles.map(
    (jobRole) => jobRole.store_job_roles.id
  ) || [];
  const currentWeekdayRows = normalizeWeekdayRows(
    userDetail?.preferredWeekdays || []
  );
  const nextWeekdayRows = normalizeWeekdayRows(
    buildWeekdayPayload(difficultWeekdays, preservedPreferredWeekdays).map(
      (weekday) => ({
        weekday: weekday.weekday,
        is_preferred: weekday.isPreferred,
      })
    )
  );

  const hasChanges =
    !compareStringArrays(jobRoleIds, currentJobRoleIds) ||
    resignationDate !== (userDetail?.resignationDate || "") ||
    desiredWeeklyHours !== (userDetail?.desiredWeeklyHours?.toString() || "") ||
    !compareWeekdayRows(nextWeekdayRows, currentWeekdayRows);

  const updateProfileMutation = useMutation({
    mutationFn: async (payload: {
      patchData: {
        jobRoleIds?: string[];
        resignationDate?: string | null;
        desiredWeeklyHours?: number | null;
        preferredWeekdays?: Array<{
          weekday: number;
          isPreferred: boolean;
        }>;
      };
      summary: UserWorkPreferencesSaveSummary;
    }) => {
      const response = await fetch(`/api/stores/${storeId}/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload.patchData),
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error);
      }

      return payload.summary;
    },
    onSuccess: (summary) => {
      queryClient.invalidateQueries({
        queryKey: ["user-detail", storeId, userId],
      });
      queryClient.invalidateQueries({ queryKey: ["store-users", storeId] });
      toast({
        title: t("user.profileUpdated", locale),
        description: t("user.profileUpdatedDescription", locale),
      });
      onSaved?.(summary);
    },
    onError: (error: Error) => {
      const errorMessage = error.message.startsWith("user.")
        ? t(error.message, locale)
        : error.message;

      toast({
        title: t("user.profileUpdateError", locale),
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleJobRoleChange = (jobRoleId: string, checked: boolean) => {
    setJobRoleIds((prev) =>
      checked
        ? [...prev, jobRoleId]
        : prev.filter((currentJobRoleId) => currentJobRoleId !== jobRoleId)
    );
  };

  const handleDifficultWeekdayChange = (weekday: number, checked: boolean) => {
    setDifficultWeekdays((prev) => {
      const next = new Set(prev);

      if (checked) {
        next.add(weekday);
      } else {
        next.delete(weekday);
      }

      return next;
    });
  };

  const handleSave = () => {
    if (!userDetail || !hasChanges) {
      return;
    }

    const patchData: {
      jobRoleIds?: string[];
      resignationDate?: string | null;
      desiredWeeklyHours?: number | null;
      preferredWeekdays?: Array<{ weekday: number; isPreferred: boolean }>;
    } = {};
    const nextWeekdayPayload = buildWeekdayPayload(
      difficultWeekdays,
      preservedPreferredWeekdays
    );

    if (!compareStringArrays(jobRoleIds, currentJobRoleIds)) {
      patchData.jobRoleIds = jobRoleIds;
    }

    if (resignationDate !== (userDetail.resignationDate || "")) {
      patchData.resignationDate = resignationDate || null;
    }

    if (desiredWeeklyHours !== (userDetail.desiredWeeklyHours?.toString() || "")) {
      patchData.desiredWeeklyHours = desiredWeeklyHours
        ? parseInt(desiredWeeklyHours, 10)
        : null;
    }

    if (!compareWeekdayRows(nextWeekdayRows, currentWeekdayRows)) {
      patchData.preferredWeekdays = nextWeekdayPayload.map((weekday) => ({
        weekday: weekday.weekday,
        isPreferred: weekday.isPreferred,
      }));
    }

    updateProfileMutation.mutate({
      patchData,
      summary: {
        userId,
        jobRoleIds,
        resignationDate: resignationDate || null,
        desiredWeeklyHours: desiredWeeklyHours
          ? parseInt(desiredWeeklyHours, 10)
          : null,
        preferredWeekdays: nextWeekdayPayload.map((weekday) => ({
          weekday: weekday.weekday,
          is_preferred: weekday.isPreferred,
        })),
      },
    });
  };

  if (userDetailLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (userDetailError) {
    return (
      <div className="rounded-md border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
        {t("user.profileUpdateError", locale)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("user.jobRoles", locale)}</CardTitle>
        </CardHeader>
        <CardContent>
          {jobRolesLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-3">
              {activeJobRoles.map((role) => (
                <div key={role.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`${mode}-job-role-${role.id}`}
                    checked={jobRoleIds.includes(role.id)}
                    onCheckedChange={(checked) =>
                      handleJobRoleChange(role.id, checked === true)
                    }
                  />
                  <Label
                    htmlFor={`${mode}-job-role-${role.id}`}
                    className="flex-1"
                  >
                    <div>
                      <div className="font-medium">{role.name}</div>
                      {role.description && (
                        <div className="text-sm text-muted-foreground">
                          {role.description}
                        </div>
                      )}
                    </div>
                  </Label>
                </div>
              ))}
              {activeJobRoles.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {t("user.jobRoles.none", locale)}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("user.workPreferences", locale)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor={`${mode}-resignation-date`}>
              {t("user.resignationDate", locale)}
            </Label>
            <Input
              id={`${mode}-resignation-date`}
              type="date"
              value={resignationDate}
              onChange={(event) => setResignationDate(event.target.value)}
              className="mt-1"
            />
            {resignationDate && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setResignationDate("")}
                className="mt-2"
              >
                {t("user.removeResignationDate", locale)}
              </Button>
            )}
          </div>

          <div>
            <Label htmlFor={`${mode}-desired-weekly-hours`}>
              {t("user.desiredWeeklyHours", locale)}
            </Label>
            <Input
              id={`${mode}-desired-weekly-hours`}
              type="number"
              min="0"
              max="168"
              placeholder={t("user.desiredWeeklyHoursPlaceholder", locale)}
              value={desiredWeeklyHours}
              onChange={(event) => setDesiredWeeklyHours(event.target.value)}
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("user.preferredWeekdays", locale)}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            {t("user.preferredWeekdays.description", locale)}
          </p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {weekdayOptions.map(({ weekday, label }) => (
              <div key={weekday} className="flex items-center space-x-2">
                <Checkbox
                  id={`${mode}-weekday-${weekday}`}
                  checked={difficultWeekdays.has(weekday)}
                  onCheckedChange={(checked) =>
                    handleDifficultWeekdayChange(weekday, checked === true)
                  }
                />
                <Label
                  htmlFor={`${mode}-weekday-${weekday}`}
                  className="text-sm"
                >
                  {label}
                </Label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        {mode === "modal" && onClose && (
          <Button
            variant="outline"
            onClick={onClose}
            disabled={updateProfileMutation.isPending}
          >
            {t("common.cancel", locale)}
          </Button>
        )}
        <Button
          onClick={handleSave}
          disabled={
            updateProfileMutation.isPending ||
            !hasChanges ||
            userDetailLoading ||
            jobRolesLoading
          }
        >
          {updateProfileMutation.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          {t("user.updateProfile", locale)}
        </Button>
      </div>
    </div>
  );
}
