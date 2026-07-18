"use client";

import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t, type Locale } from "@/lib/i18n";
import type { OperatingPatternPayload } from "@/lib/validations/schedule/operating-patterns";

export interface OperatingPatternJobRole {
  id: string;
  name: string;
  code: string;
}

type Segment = OperatingPatternPayload["segments"][number];

function formatTime(minutes: number): string {
  if (minutes === 1440) {
    return "00:00";
  }
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function parseTime(value: string, isEnd: boolean): number {
  const [hour = "0", minute = "0"] = value.split(":");
  const parsed = Number(hour) * 60 + Number(minute);
  return isEnd && parsed === 0 ? 1440 : parsed;
}

export function OperatingPatternSegmentEditor({
  segment,
  jobRoles,
  locale,
  onChange,
  onRemove,
}: {
  segment: Segment;
  jobRoles: OperatingPatternJobRole[];
  locale: Locale;
  onChange: (segment: Segment) => void;
  onRemove: () => void;
}) {
  const update = (partial: Partial<Segment>) =>
    onChange({ ...segment, ...partial });

  const toggleRole = (roleId: string, checked: boolean) => {
    const roleIds = new Set(segment.requiredRoleIds);
    if (checked) {
      roleIds.add(roleId);
    } else {
      roleIds.delete(roleId);
    }
    update({ requiredRoleIds: [...roleIds] });
  };

  return (
    <div className="relative space-y-4 rounded-md border bg-gray-50 p-4 pr-12">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onRemove}
        aria-label={t("autoSchedule.pattern.removeSegment", locale)}
        title={t("autoSchedule.pattern.removeSegment", locale)}
        className="absolute right-1 top-1 h-11 w-11"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-[minmax(10rem,1fr)_9rem_9rem_8rem] xl:items-end">
        <div className="space-y-2">
          <Label htmlFor={`segment-name-${segment.id}`}>
            {t("autoSchedule.pattern.segmentName", locale)}
          </Label>
          <Input
            id={`segment-name-${segment.id}`}
            value={segment.name}
            onChange={(event) => update({ name: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`segment-start-${segment.id}`}>
            {t("autoSchedule.pattern.startTime", locale)}
          </Label>
          <Input
            id={`segment-start-${segment.id}`}
            type="time"
            value={formatTime(segment.startMin)}
            onChange={(event) =>
              update({ startMin: parseTime(event.target.value, false) })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`segment-end-${segment.id}`}>
            {t("autoSchedule.pattern.endTime", locale)}
          </Label>
          <Input
            id={`segment-end-${segment.id}`}
            type="time"
            value={formatTime(segment.endMin)}
            onChange={(event) =>
              update({ endMin: parseTime(event.target.value, true) })
            }
          />
          {segment.endMin === 1440 && (
            <p className="text-xs text-gray-500">
              {t("autoSchedule.pattern.nextDay", locale)}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor={`segment-headcount-${segment.id}`}>
            {t("autoSchedule.pattern.minHeadcount", locale)}
          </Label>
          <Input
            id={`segment-headcount-${segment.id}`
            }
            type="number"
            min={1}
            max={99}
            value={segment.minHeadcount}
            onChange={(event) =>
              update({ minHeadcount: Number(event.target.value) })
            }
          />
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-gray-900">
          {t("autoSchedule.pattern.requiredRoles", locale)}
        </legend>
        {jobRoles.length === 0 ? (
          <p className="text-sm text-amber-700">
            {t("autoSchedule.pattern.noRoles", locale)}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {jobRoles.map((role) => (
              <label
                key={role.id}
                className="flex min-h-10 items-center gap-2 rounded-md border bg-white px-3 py-2"
              >
                <Checkbox
                  checked={segment.requiredRoleIds.includes(role.id)}
                  onCheckedChange={(checked) =>
                    toggleRole(role.id, checked === true)
                  }
                />
                <span className="min-w-0 truncate text-sm text-gray-800">
                  {role.name}
                </span>
              </label>
            ))}
          </div>
        )}
      </fieldset>
    </div>
  );
}
