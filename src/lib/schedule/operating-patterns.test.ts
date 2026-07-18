import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateWorkItemOverflowMinutes,
  evaluateOperatingSegmentCoverage,
  findOperatingPatternValidationIssues,
} from "./operating-patterns";

test("a multi-role employee can cover multiple required roles but counts once", () => {
  const coverage = evaluateOperatingSegmentCoverage(
    {
      startMin: 660,
      endMin: 1050,
      minHeadcount: 2,
      requiredRoleIds: ["supervisor", "kitchen", "cashier"],
    },
    [
      {
        userId: "user-a",
        startMin: 600,
        endMin: 1350,
        roleIds: ["supervisor", "cashier"],
      },
      {
        userId: "user-b",
        startMin: 660,
        endMin: 1050,
        roleIds: ["kitchen"],
      },
    ]
  );

  assert.equal(coverage.assignedHeadcount, 2);
  assert.deepEqual(coverage.missingRoleIds, []);
  assert.equal(coverage.isSatisfied, true);
});

test("an assignment must cover the complete segment", () => {
  const coverage = evaluateOperatingSegmentCoverage(
    {
      startMin: 1050,
      endMin: 1320,
      minHeadcount: 2,
      requiredRoleIds: ["supervisor", "cashier"],
    },
    [
      {
        userId: "user-a",
        startMin: 1050,
        endMin: 1320,
        roleIds: ["supervisor"],
      },
      {
        userId: "user-b",
        startMin: 1050,
        endMin: 1200,
        roleIds: ["cashier"],
      },
    ]
  );

  assert.equal(coverage.assignedHeadcount, 1);
  assert.deepEqual(coverage.missingRoleIds, ["cashier"]);
  assert.equal(coverage.isSatisfied, false);
});

test("the work item with the least time outside a segment has the smallest overflow", () => {
  assert.equal(calculateWorkItemOverflowMinutes(660, 1050, 660, 1050), 0);
  assert.equal(calculateWorkItemOverflowMinutes(600, 1350, 660, 1050), 360);
  assert.equal(calculateWorkItemOverflowMinutes(660, 1440, 660, 1050), 390);
  assert.equal(calculateWorkItemOverflowMinutes(900, 1200, 660, 1050), null);
});

test("duplicate weekdays and overlapping segments are blocking validation issues", () => {
  const issues = findOperatingPatternValidationIssues([
    {
      id: "pattern-a",
      name: "Weekday",
      weekdays: [1, 2, 3],
      segments: [
        {
          id: "segment-a",
          name: "Morning",
          startMin: 600,
          endMin: 900,
          minHeadcount: 1,
          requiredRoleIds: [],
        },
        {
          id: "segment-b",
          name: "Lunch",
          startMin: 840,
          endMin: 1050,
          minHeadcount: 2,
          requiredRoleIds: ["cashier"],
        },
      ],
    },
    {
      id: "pattern-b",
      name: "Tuesday",
      weekdays: [2],
      segments: [],
    },
  ]);

  assert.equal(
    issues.some((issue) => issue.code === "DUPLICATE_WEEKDAY"),
    true
  );
  assert.equal(
    issues.some((issue) => issue.code === "OVERLAPPING_SEGMENTS"),
    true
  );
  assert.equal(
    issues.some((issue) => issue.code === "MISSING_REQUIRED_ROLES"),
    true
  );
});
