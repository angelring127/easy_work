import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateDesiredDailyHoursFitScore,
  calculateDesiredWeeklyHoursScore,
  calculateFutureCoverageClosureRisk,
  calculateFutureCoverageGain,
  compareOperatingAssignmentChoices,
  type OperatingAssignmentChoice,
} from "./assignment-ranking";

const neutralRoleAllocation = {
  minimumAssignmentsNeeded: 1,
  reservedRoleCost: 0,
  coverageGain: 1,
};

function choice(
  overrides: Partial<OperatingAssignmentChoice>
): OperatingAssignmentChoice {
  return {
    candidateId: "candidate",
    workItemId: "work-item",
    roleAllocation: neutralRoleAllocation,
    futureCoverageClosureRisk: 0,
    desiredWeeklyOverflowMinutes: 0,
    dailyHoursFitScore: 0,
    futureCoverageGain: 0,
    preferenceScore: 0,
    weeklyMinutes: 0,
    monthlyMinutes: 0,
    lastAssignedTime: 0,
    workItemUsageCount: 0,
    overflowMinutes: 0,
    ...overrides,
  };
}

test("ranks a full-time choice first when it covers more unmet operating segments", () => {
  const ranked = [
    choice({
      workItemId: "half-time",
      futureCoverageGain: 390,
      overflowMinutes: 0,
    }),
    choice({
      workItemId: "full-time",
      futureCoverageGain: 1170,
      overflowMinutes: 390,
    }),
  ].sort(compareOperatingAssignmentChoices);

  assert.equal(ranked[0]?.workItemId, "full-time");
});

test("preserves future required-role coverage before soft hours preferences", () => {
  const ranked = [
    choice({
      candidateId: "time-fit",
      desiredWeeklyOverflowMinutes: 0,
      dailyHoursFitScore: 30,
      futureCoverageClosureRisk: 1,
    }),
    choice({
      candidateId: "future-role-coverage",
      desiredWeeklyOverflowMinutes: 30,
      dailyHoursFitScore: 0,
      futureCoverageClosureRisk: 0,
    }),
  ].sort(compareOperatingAssignmentChoices);

  assert.equal(ranked[0]?.candidateId, "future-role-coverage");
});

test("uses an underrepresented registered work item when both choices cover the current need", () => {
  const ranked = [
    choice({
      workItemId: "half-time",
      futureCoverageGain: 390,
      workItemUsageCount: 0,
    }),
    choice({
      workItemId: "full-time",
      futureCoverageGain: 1170,
      workItemUsageCount: 3,
    }),
  ].sort(compareOperatingAssignmentChoices);

  assert.equal(ranked[0]?.workItemId, "half-time");
});

test("prefers a 12-hour full-time match over a less-used short work item", () => {
  const ranked = [
    choice({
      candidateId: "yeonsu",
      workItemId: "half-time",
      dailyHoursFitScore: 54,
      workItemUsageCount: 0,
    }),
    choice({
      candidateId: "yeonsu",
      workItemId: "full-time",
      dailyHoursFitScore: 100,
      workItemUsageCount: 3,
    }),
  ].sort(compareOperatingAssignmentChoices);

  assert.equal(ranked[0]?.workItemId, "full-time");
});

test("uses a short shift when full time would exceed desired weekly hours", () => {
  const ranked = [
    choice({
      candidateId: "yeonsu",
      workItemId: "full-time",
      desiredWeeklyOverflowMinutes: 270,
      dailyHoursFitScore: 100,
    }),
    choice({
      candidateId: "yeonsu",
      workItemId: "half-time",
      desiredWeeklyOverflowMinutes: 0,
      dailyHoursFitScore: 54,
    }),
  ].sort(compareOperatingAssignmentChoices);

  assert.equal(ranked[0]?.workItemId, "half-time");
});

test("does not prefer a 12-hour worker for a 6.5-hour shift over a neutral worker", () => {
  const preferredTwelveHourScore = calculateDesiredDailyHoursFitScore({
    slotMinutes: 390,
    desiredHours: 12,
  });
  const neutralScore = calculateDesiredDailyHoursFitScore({
    slotMinutes: 390,
    desiredHours: null,
  });

  assert.ok(preferredTwelveHourScore < neutralScore);
});

test("combines daily and weekly preference scores across employees", () => {
  const ranked = [
    choice({
      candidateId: "daily-match",
      dailyHoursFitScore: 30,
      preferenceScore: 0,
    }),
    choice({
      candidateId: "weekly-target-gap",
      dailyHoursFitScore: 9,
      preferenceScore: 24,
    }),
  ].sort(compareOperatingAssignmentChoices);

  assert.equal(ranked[0]?.candidateId, "weekly-target-gap");
});

test("uses preferred-hours fit before preserving an otherwise unused scarce role", () => {
  const ranked = [
    choice({
      candidateId: "weekly-target-gap",
      dailyHoursFitScore: 9,
      preferenceScore: 24,
    }),
    choice({
      candidateId: "neutral-hours",
      dailyHoursFitScore: 15,
      preferenceScore: 15,
    }),
  ].sort(compareOperatingAssignmentChoices);

  assert.equal(ranked[0]?.candidateId, "weekly-target-gap");
});

test("preserves a scarce role when later operating segments still require it", () => {
  const ranked = [
    choice({
      candidateId: "future-scarce-role",
      roleAllocation: {
        ...neutralRoleAllocation,
        reservedRoleCost: 1 / 3,
      },
      dailyHoursFitScore: 9,
      preferenceScore: 24,
    }),
    choice({
      candidateId: "neutral-hours",
      dailyHoursFitScore: 15,
      preferenceScore: 15,
    }),
  ].sort(compareOperatingAssignmentChoices);

  assert.equal(ranked[0]?.candidateId, "neutral-hours");
});

test("gives the weekly-hours score to the worker further below their target", () => {
  const lessAssignedScore = calculateDesiredWeeklyHoursScore({
    currentMinutes: 0,
    slotMinutes: 390,
    desiredHours: 40,
    weight: 30,
  });
  const moreAssignedScore = calculateDesiredWeeklyHoursScore({
    currentMinutes: 1440,
    slotMinutes: 390,
    desiredHours: 40,
    weight: 30,
  });

  assert.ok(lessAssignedScore > moreAssignedScore);
});

test("gives a higher weekly-hours score when more full shifts remain to reach the target", () => {
  const fortyHourTargetScore = calculateDesiredWeeklyHoursScore({
    currentMinutes: 0,
    slotMinutes: 720,
    desiredHours: 40,
    weight: 30,
  });
  const thirtyHourTargetScore = calculateDesiredWeeklyHoursScore({
    currentMinutes: 0,
    slotMinutes: 720,
    desiredHours: 30,
    weight: 30,
  });

  assert.ok(fortyHourTargetScore > thirtyHourTargetScore);
});

test("counts future headcount and role coverage across every segment the slot spans", () => {
  const gain = calculateFutureCoverageGain({
    slotStartMin: 660,
    slotEndMin: 1440,
    candidateRoleIds: new Set(["cook", "server"]),
    segmentNeeds: [
      {
        startMin: 660,
        endMin: 1050,
        missingHeadcount: 1,
        missingRoleIds: new Set(["cook", "server"]),
      },
      {
        startMin: 1050,
        endMin: 1350,
        missingHeadcount: 2,
        missingRoleIds: new Set(["cook", "server"]),
      },
      {
        startMin: 1350,
        endMin: 1440,
        missingHeadcount: 2,
        missingRoleIds: new Set(["cook", "server"]),
      },
    ],
  });

  assert.equal(gain, 2340);
});

test("reports uncovered roles when a shift fills a future segment's last required place", () => {
  const risk = calculateFutureCoverageClosureRisk({
    slotStartMin: 1050,
    slotEndMin: 1440,
    candidateRoleIds: new Set(["cook"]),
    segmentNeeds: [
      {
        startMin: 1350,
        endMin: 1440,
        missingHeadcount: 1,
        missingRoleIds: new Set(["server"]),
      },
    ],
  });

  assert.equal(risk, 1);
});
