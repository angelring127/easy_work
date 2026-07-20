import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateDesiredDailyHoursFitScore,
  calculateDesiredWeeklyHoursScore,
  calculateDesiredWeeklyOverflowMinutes,
  calculateFutureCoverageClosureRisk,
  calculateFutureCoverageGain,
  compareOperatingAssignmentChoices,
} from "./assignment-ranking";
import {
  calculateWorkItemOverflowMinutes,
  evaluateOperatingSegmentCoverage,
  type SegmentCoverageTarget,
} from "./operating-patterns";
import { evaluateRoleAllocationCandidate } from "./role-allocation";
import { wouldExceedConcurrentStaffLimit } from "./staff-limits";

type Candidate = {
  readonly id: string;
  readonly roleIds: ReadonlySet<string>;
  readonly desiredDailyHours: number | null;
  readonly desiredWeeklyHours: number | null;
  readonly difficultWeekdays: ReadonlySet<number>;
  readonly priorityRank: number;
};

const candidates: readonly Candidate[] = [
  { id: "Bagus", roleIds: new Set(["cook"]), desiredDailyHours: null, desiredWeeklyHours: null, difficultWeekdays: new Set(), priorityRank: 6 },
  { id: "Com", roleIds: new Set(["cook", "server", "supervisor"]), desiredDailyHours: null, desiredWeeklyHours: null, difficultWeekdays: new Set(), priorityRank: 2 },
  { id: "SangHo", roleIds: new Set(["cook", "server"]), desiredDailyHours: 12, desiredWeeklyHours: 30, difficultWeekdays: new Set(), priorityRank: 5 },
  { id: "Veri", roleIds: new Set(["cook", "supervisor"]), desiredDailyHours: 12, desiredWeeklyHours: 35, difficultWeekdays: new Set(), priorityRank: 4 },
  { id: "Ariya", roleIds: new Set(["cook", "server"]), desiredDailyHours: null, desiredWeeklyHours: 40, difficultWeekdays: new Set([2, 3]), priorityRank: 3 },
  { id: "Yeonsu", roleIds: new Set(["server"]), desiredDailyHours: 12, desiredWeeklyHours: 40, difficultWeekdays: new Set(), priorityRank: 7 },
  { id: "Kurumi", roleIds: new Set(["cook", "server", "supervisor"]), desiredDailyHours: null, desiredWeeklyHours: null, difficultWeekdays: new Set(), priorityRank: 1 },
];

const workItems = [
  { id: "opening", startMin: 600, endMin: 1350, breakMin: 0, roleIds: new Set(["supervisor"]) },
  { id: "half-time", startMin: 660, endMin: 1050, breakMin: 0, roleIds: new Set(["cook", "server", "supervisor"]) },
  { id: "full-time", startMin: 660, endMin: 1440, breakMin: 60, roleIds: new Set(["cook", "server", "supervisor"]) },
  { id: "closing", startMin: 1050, endMin: 1440, breakMin: 0, roleIds: new Set(["cook", "server", "supervisor"]) },
] as const;

const segments: readonly SegmentCoverageTarget[] = [
  { startMin: 600, endMin: 660, minHeadcount: 1, requiredRoleIds: ["supervisor"] },
  { startMin: 660, endMin: 1050, minHeadcount: 2, requiredRoleIds: ["cook", "server", "supervisor"] },
  { startMin: 1050, endMin: 1350, minHeadcount: 3, requiredRoleIds: ["cook", "server", "supervisor"] },
  { startMin: 1350, endMin: 1440, minHeadcount: 2, requiredRoleIds: ["cook", "server"] },
];

test("covers the Granvile week while using every registered work item and respecting weekly limits", () => {
  const weeklyMinutes = new Map<string, number>();
  const monthlyMinutes = new Map<string, number>();
  const usageCount = new Map<string, number>();
  const assignedWorkItemsByCandidate = new Map<string, string[]>();

  for (let weekday = 1; weekday <= 7; weekday += 1) {
    const normalizedWeekday = weekday % 7;
    const assignments: Array<{ candidate: Candidate; workItem: typeof workItems[number] }> = [];

    for (const segment of segments) {
      for (let attempt = 0; attempt < candidates.length; attempt += 1) {
        const coverageAssignments = assignments.map(({ candidate, workItem }) => ({
          userId: candidate.id,
          startMin: workItem.startMin,
          endMin: workItem.endMin,
          roleIds: candidate.roleIds,
        }));
        const coverage = evaluateOperatingSegmentCoverage(segment, coverageAssignments);
        if (coverage.isSatisfied) {
          break;
        }

        const segmentNeeds = segments.map((candidateSegment) => {
          const candidateCoverage = evaluateOperatingSegmentCoverage(
            candidateSegment,
            coverageAssignments
          );
          return {
            startMin: candidateSegment.startMin,
            endMin: candidateSegment.endMin,
            missingHeadcount: Math.max(0, candidateSegment.minHeadcount - candidateCoverage.assignedHeadcount),
            missingRoleIds: new Set(candidateCoverage.missingRoleIds),
          };
        });
        const missingRoleIds = new Set(coverage.missingRoleIds);
        const remainingHeadcount = Math.max(0, segment.minHeadcount - coverage.assignedHeadcount);
        const futureReservableRoleIds =
          normalizedWeekday === 0
            ? new Set<string>()
            : new Set(["supervisor"]);
        const choices = workItems.flatMap((workItem) => {
          const overflowMinutes = calculateWorkItemOverflowMinutes(
            workItem.startMin,
            workItem.endMin,
            segment.startMin,
            segment.endMin
          );
          if (overflowMinutes === null) {
            return [];
          }
          if (wouldExceedConcurrentStaffLimit({
            assignments: assignments.map(({ workItem: assignedItem }) => ({ startMin: assignedItem.startMin, endMin: assignedItem.endMin })),
            proposedSlot: { startMin: workItem.startMin, endMin: workItem.endMin },
            boundaryMin: 720,
            maxMorningStaff: 2,
            maxAfternoonStaff: 3,
          })) {
            return [];
          }

          const eligible = candidates.filter((candidate) =>
            !assignments.some((assignment) => assignment.candidate.id === candidate.id) &&
            !candidate.difficultWeekdays.has(normalizedWeekday) &&
            [...workItem.roleIds].some((roleId) => candidate.roleIds.has(roleId)) &&
            (weeklyMinutes.get(candidate.id) || 0) + workItem.endMin - workItem.startMin - workItem.breakMin <= 2400
          );
          return eligible.map((candidate) => {
            const slotMinutes = workItem.endMin - workItem.startMin - workItem.breakMin;
            return {
              candidate,
              workItem,
              candidateId: candidate.id,
              workItemId: workItem.id,
              roleAllocation: evaluateRoleAllocationCandidate({
                candidateRoleIds: candidate.roleIds,
                otherCandidateRoleIds: eligible.filter((other) => other.id !== candidate.id).map((other) => other.roleIds),
                missingRoleIds,
                remainingHeadcount,
                reservableRoleIds: futureReservableRoleIds,
                roleMemberCounts: new Map([["cook", 6], ["server", 5], ["supervisor", 3]]),
              }),
              futureCoverageClosureRisk:
                calculateFutureCoverageClosureRisk({
                  slotStartMin: workItem.startMin,
                  slotEndMin: workItem.endMin,
                  candidateRoleIds: candidate.roleIds,
                  segmentNeeds,
                }),
              desiredWeeklyOverflowMinutes:
                calculateDesiredWeeklyOverflowMinutes({
                  currentMinutes: weeklyMinutes.get(candidate.id) || 0,
                  slotMinutes,
                  desiredHours: candidate.desiredWeeklyHours,
                }),
              dailyHoursFitScore: calculateDesiredDailyHoursFitScore({
                slotMinutes,
                desiredHours: candidate.desiredDailyHours,
              }),
              futureCoverageGain: calculateFutureCoverageGain({
                slotStartMin: workItem.startMin,
                slotEndMin: workItem.endMin,
                candidateRoleIds: candidate.roleIds,
                segmentNeeds,
              }),
              preferenceScore: calculateDesiredWeeklyHoursScore({
                currentMinutes: weeklyMinutes.get(candidate.id) || 0,
                slotMinutes,
                desiredHours: candidate.desiredWeeklyHours,
                weight: 30,
              }) + (8 - candidate.priorityRank),
              weeklyMinutes: weeklyMinutes.get(candidate.id) || 0,
              monthlyMinutes: monthlyMinutes.get(candidate.id) || 0,
              lastAssignedTime: 0,
              workItemUsageCount: usageCount.get(workItem.id) || 0,
              overflowMinutes,
            };
          });
        });
        const [selected] = choices.sort(compareOperatingAssignmentChoices);
        assert.ok(
          selected,
          `No assignment available on weekday ${normalizedWeekday}; assigned ${assignments
            .map(({ candidate, workItem }) => `${candidate.id}:${workItem.id}`)
            .join(",")}; weekly ${JSON.stringify(Object.fromEntries(weeklyMinutes))}`
        );
        assignments.push({ candidate: selected.candidate, workItem: selected.workItem });
        const paidMinutes = selected.workItem.endMin - selected.workItem.startMin - selected.workItem.breakMin;
        weeklyMinutes.set(selected.candidate.id, (weeklyMinutes.get(selected.candidate.id) || 0) + paidMinutes);
        monthlyMinutes.set(selected.candidate.id, (monthlyMinutes.get(selected.candidate.id) || 0) + paidMinutes);
        usageCount.set(selected.workItem.id, (usageCount.get(selected.workItem.id) || 0) + 1);
        const assignedWorkItems =
          assignedWorkItemsByCandidate.get(selected.candidate.id) || [];
        assignedWorkItems.push(selected.workItem.id);
        assignedWorkItemsByCandidate.set(
          selected.candidate.id,
          assignedWorkItems
        );
      }
    }

    for (const segment of segments) {
      assert.equal(evaluateOperatingSegmentCoverage(segment, assignments.map(({ candidate, workItem }) => ({
        userId: candidate.id,
        startMin: workItem.startMin,
        endMin: workItem.endMin,
        roleIds: candidate.roleIds,
      }))).isSatisfied, true);
    }

  }

  assert.deepEqual([...usageCount.keys()].sort(), ["closing", "full-time", "half-time", "opening"]);
  assert.equal(
    assignedWorkItemsByCandidate.get("Yeonsu")?.[0],
    "full-time"
  );
  const desiredWeeklyMinutes = new Map(
    candidates.flatMap((candidate) =>
      candidate.desiredWeeklyHours === null
        ? []
        : [[candidate.id, candidate.desiredWeeklyHours * 60] as const]
    )
  );
  const totalTargetDeviationMinutes = [...desiredWeeklyMinutes].reduce(
    (total, [candidateId, targetMinutes]) =>
      total + Math.abs(targetMinutes - (weeklyMinutes.get(candidateId) || 0)),
    0
  );
  const maximumShortShiftCount = Math.max(
    ...candidates
      .filter((candidate) => candidate.desiredDailyHours === 12)
      .map((candidate) =>
        (assignedWorkItemsByCandidate.get(candidate.id) || []).filter(
          (workItemId) =>
            workItemId === "half-time" || workItemId === "closing"
        ).length
      )
  );
  const twelveHourWorkersHaveLongShift = candidates
    .filter((candidate) => candidate.desiredDailyHours === 12)
    .every((candidate) =>
      (assignedWorkItemsByCandidate.get(candidate.id) || []).some(
        (workItemId) =>
          workItemId === "opening" || workItemId === "full-time"
      )
    );
  assert.ok(totalTargetDeviationMinutes <= 1260);
  assert.ok(twelveHourWorkersHaveLongShift);
  assert.ok(maximumShortShiftCount <= 2);
  assert.ok([...weeklyMinutes.values()].every((minutes) => minutes <= 2400));
});
