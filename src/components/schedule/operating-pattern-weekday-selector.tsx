"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { t, type Locale } from "@/lib/i18n";

const weekdays = [1, 2, 3, 4, 5, 6, 0] as const;

const weekdayKeys: Record<number, string> = {
  0: "autoSchedule.pattern.weekday.sun",
  1: "autoSchedule.pattern.weekday.mon",
  2: "autoSchedule.pattern.weekday.tue",
  3: "autoSchedule.pattern.weekday.wed",
  4: "autoSchedule.pattern.weekday.thu",
  5: "autoSchedule.pattern.weekday.fri",
  6: "autoSchedule.pattern.weekday.sat",
};

export function OperatingPatternWeekdaySelector({
  selectedWeekdays,
  disabledWeekdays,
  locale,
  onChange,
}: {
  selectedWeekdays: number[];
  disabledWeekdays: Set<number>;
  locale: Locale;
  onChange: (weekdays: number[]) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-gray-900">
        {t("autoSchedule.pattern.weekdays", locale)}
      </legend>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
        {weekdays.map((weekday) => {
          const checked = selectedWeekdays.includes(weekday);
          return (
            <label
              key={weekday}
              className="flex min-h-10 items-center justify-center gap-2 rounded-md border px-2 py-2 text-sm"
            >
              <Checkbox
                checked={checked}
                disabled={disabledWeekdays.has(weekday)}
                onCheckedChange={(nextChecked) =>
                  onChange(
                    nextChecked === true
                      ? [...selectedWeekdays, weekday].sort()
                      : selectedWeekdays.filter((value) => value !== weekday)
                  )
                }
              />
              {t(weekdayKeys[weekday], locale)}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
