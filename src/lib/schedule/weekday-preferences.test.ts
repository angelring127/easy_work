import assert from "node:assert/strict";
import test from "node:test";

import { groupLegacyUserWeekdayPreferences } from "./weekday-preferences";

test("treats the stored true flag as a difficult weekday", () => {
  const rows = [
    { user_id: "worker", weekday: 1, is_preferred: true },
  ] as const;

  const { difficultByUser } = groupLegacyUserWeekdayPreferences(rows);

  assert.deepEqual([...difficultByUser.get("worker") || []], [1]);
});

test("treats the stored false flag as a preferred weekday", () => {
  const rows = [
    { user_id: "worker", weekday: 2, is_preferred: false },
  ] as const;

  const { preferredByUser } = groupLegacyUserWeekdayPreferences(rows);

  assert.deepEqual([...preferredByUser.get("worker") || []], [2]);
});
