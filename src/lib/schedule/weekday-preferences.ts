export type LegacyUserWeekdayPreferenceRow = {
  readonly user_id: string;
  readonly weekday: number;
  readonly is_preferred: boolean;
};

export type UserWeekdayPreferenceMaps = {
  readonly difficultByUser: Map<string, Set<number>>;
  readonly preferredByUser: Map<string, Set<number>>;
};

export function groupLegacyUserWeekdayPreferences(
  rows: readonly LegacyUserWeekdayPreferenceRow[]
): UserWeekdayPreferenceMaps {
  const difficultByUser = new Map<string, Set<number>>();
  const preferredByUser = new Map<string, Set<number>>();

  rows.forEach((row) => {
    const targetMap = row.is_preferred ? difficultByUser : preferredByUser;
    const weekdays = targetMap.get(row.user_id) || new Set<number>();
    weekdays.add(row.weekday);
    targetMap.set(row.user_id, weekdays);
  });

  return { difficultByUser, preferredByUser };
}
