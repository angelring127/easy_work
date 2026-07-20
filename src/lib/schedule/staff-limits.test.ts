import assert from "node:assert/strict";
import test from "node:test";
import { evaluateOperatingSegmentCoverage } from "./operating-patterns";
import { wouldExceedConcurrentStaffLimit } from "./staff-limits";

test("allows a shift when touching shifts do not exceed peak concurrent staff", () => {
  const assignments = [
    { startMin: 600, endMin: 1350 },
    { startMin: 660, endMin: 1050 },
    { startMin: 1050, endMin: 1440 },
  ];

  const exceedsLimit = wouldExceedConcurrentStaffLimit({
    assignments,
    proposedSlot: { startMin: 1050, endMin: 1440 },
    boundaryMin: 960,
    maxMorningStaff: 2,
    maxAfternoonStaff: 3,
  });

  assert.equal(exceedsLimit, false);
});

test("rejects a shift when it exceeds peak concurrent staff", () => {
  const assignments = [
    { startMin: 600, endMin: 1350 },
    { startMin: 660, endMin: 1050 },
    { startMin: 1050, endMin: 1440 },
    { startMin: 1050, endMin: 1440 },
  ];

  const exceedsLimit = wouldExceedConcurrentStaffLimit({
    assignments,
    proposedSlot: { startMin: 1050, endMin: 1440 },
    boundaryMin: 960,
    maxMorningStaff: 2,
    maxAfternoonStaff: 3,
  });

  assert.equal(exceedsLimit, true);
});

test("fills adjacent afternoon and closing segments within the concurrent limit", () => {
  const existingAssignments = [
    { userId: "opening", startMin: 600, endMin: 1350, roleIds: ["supervisor"] },
    { userId: "half", startMin: 660, endMin: 1050, roleIds: ["server"] },
    { userId: "closing-1", startMin: 1050, endMin: 1440, roleIds: ["cook", "server"] },
  ];
  const proposedAssignment = {
    userId: "closing-2",
    startMin: 1050,
    endMin: 1440,
    roleIds: ["cook"],
  };
  const assignments = [...existingAssignments, proposedAssignment];
  const exceedsLimit = wouldExceedConcurrentStaffLimit({
    assignments: existingAssignments,
    proposedSlot: proposedAssignment,
    boundaryMin: 960,
    maxMorningStaff: 2,
    maxAfternoonStaff: 3,
  });

  const afternoonCoverage = evaluateOperatingSegmentCoverage(
    {
      startMin: 1050,
      endMin: 1350,
      minHeadcount: 3,
      requiredRoleIds: ["cook", "server", "supervisor"],
    },
    assignments
  );
  const closingCoverage = evaluateOperatingSegmentCoverage(
    {
      startMin: 1350,
      endMin: 1440,
      minHeadcount: 2,
      requiredRoleIds: ["cook", "server"],
    },
    assignments
  );

  assert.deepEqual(
    [exceedsLimit, afternoonCoverage.isSatisfied, closingCoverage.isSatisfied],
    [false, true, true]
  );
});
