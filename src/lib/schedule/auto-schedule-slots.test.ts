import assert from "node:assert/strict";
import test from "node:test";

import { createWorkItemSlots } from "./auto-schedule-slots";

test("registered work items become generic slots regardless of their names", () => {
  const slots = createWorkItemSlots("2026-07-20", [
    {
      id: "opening-item",
      name: "Opening",
      start_min: 600,
      end_min: 1350,
      unpaid_break_min: 30,
      max_headcount: 1,
    },
    {
      id: "half-time-item",
      name: "Half time",
      start_min: 660,
      end_min: 1050,
      unpaid_break_min: null,
      max_headcount: 2,
    },
  ]);

  assert.deepEqual(
    slots.map((slot) => ({
      workItemId: slot.workItem.id,
      startMin: slot.startMin,
      endMin: slot.endMin,
      unpaidBreakMin: slot.unpaidBreakMin,
      hasOpeningFlag: "isOpening" in slot,
    })),
    [
      {
        workItemId: "opening-item",
        startMin: 600,
        endMin: 1350,
        unpaidBreakMin: 30,
        hasOpeningFlag: false,
      },
      {
        workItemId: "half-time-item",
        startMin: 660,
        endMin: 1050,
        unpaidBreakMin: 0,
        hasOpeningFlag: false,
      },
    ]
  );
});
