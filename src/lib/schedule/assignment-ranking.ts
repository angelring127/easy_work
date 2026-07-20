import {
  type RoleAllocationMetrics,
} from "./role-allocation";

export type OperatingAssignmentChoice = {
  readonly candidateId: string;
  readonly workItemId: string;
  readonly roleAllocation: RoleAllocationMetrics;
  readonly futureCoverageClosureRisk: number;
  readonly desiredWeeklyOverflowMinutes: number;
  readonly dailyHoursFitScore: number;
  readonly futureCoverageGain: number;
  readonly preferenceScore: number;
  readonly weeklyMinutes: number;
  readonly monthlyMinutes: number;
  readonly lastAssignedTime: number;
  readonly workItemUsageCount: number;
  readonly overflowMinutes: number;
};

export type SegmentCoverageNeed = {
  readonly startMin: number;
  readonly endMin: number;
  readonly missingHeadcount: number;
  readonly missingRoleIds: ReadonlySet<string>;
};

const RESERVED_ROLE_SCORE_WEIGHT = 30;

export function compareOperatingAssignmentChoices(
  left: OperatingAssignmentChoice,
  right: OperatingAssignmentChoice
): number {
  if (
    left.roleAllocation.minimumAssignmentsNeeded !==
    right.roleAllocation.minimumAssignmentsNeeded
  ) {
    return (
      left.roleAllocation.minimumAssignmentsNeeded -
      right.roleAllocation.minimumAssignmentsNeeded
    );
  }

  if (left.roleAllocation.coverageGain !== right.roleAllocation.coverageGain) {
    return right.roleAllocation.coverageGain - left.roleAllocation.coverageGain;
  }

  if (
    left.futureCoverageClosureRisk !== right.futureCoverageClosureRisk
  ) {
    return left.futureCoverageClosureRisk - right.futureCoverageClosureRisk;
  }

  if (
    left.desiredWeeklyOverflowMinutes !==
    right.desiredWeeklyOverflowMinutes
  ) {
    return (
      left.desiredWeeklyOverflowMinutes -
      right.desiredWeeklyOverflowMinutes
    );
  }

  const leftPreferenceScore =
    left.dailyHoursFitScore +
    left.preferenceScore -
    left.roleAllocation.reservedRoleCost * RESERVED_ROLE_SCORE_WEIGHT;
  const rightPreferenceScore =
    right.dailyHoursFitScore +
    right.preferenceScore -
    right.roleAllocation.reservedRoleCost * RESERVED_ROLE_SCORE_WEIGHT;
  if (leftPreferenceScore !== rightPreferenceScore) {
    return rightPreferenceScore - leftPreferenceScore;
  }

  if (
    left.workItemId === right.workItemId &&
    left.futureCoverageGain !== right.futureCoverageGain
  ) {
    return right.futureCoverageGain - left.futureCoverageGain;
  }

  if (left.workItemUsageCount !== right.workItemUsageCount) {
    return left.workItemUsageCount - right.workItemUsageCount;
  }

  if (
    left.workItemId !== right.workItemId &&
    left.futureCoverageGain !== right.futureCoverageGain
  ) {
    return right.futureCoverageGain - left.futureCoverageGain;
  }

  if (left.weeklyMinutes !== right.weeklyMinutes) {
    return left.weeklyMinutes - right.weeklyMinutes;
  }

  if (left.monthlyMinutes !== right.monthlyMinutes) {
    return left.monthlyMinutes - right.monthlyMinutes;
  }

  if (left.lastAssignedTime !== right.lastAssignedTime) {
    return left.lastAssignedTime - right.lastAssignedTime;
  }

  if (left.overflowMinutes !== right.overflowMinutes) {
    return left.overflowMinutes - right.overflowMinutes;
  }

  const candidateDifference = left.candidateId.localeCompare(right.candidateId);
  return candidateDifference || left.workItemId.localeCompare(right.workItemId);
}

export function calculateFutureCoverageGain({
  slotStartMin,
  slotEndMin,
  candidateRoleIds,
  segmentNeeds,
}: {
  readonly slotStartMin: number;
  readonly slotEndMin: number;
  readonly candidateRoleIds: ReadonlySet<string>;
  readonly segmentNeeds: readonly SegmentCoverageNeed[];
}): number {
  return segmentNeeds.reduce((gain, segment) => {
    if (
      slotStartMin > segment.startMin ||
      slotEndMin < segment.endMin
    ) {
      return gain;
    }

    const durationMinutes = segment.endMin - segment.startMin;
    const headcountGain = segment.missingHeadcount > 0 ? 1 : 0;
    const roleGain = [...segment.missingRoleIds].filter((roleId) =>
      candidateRoleIds.has(roleId)
    ).length;
    return gain + durationMinutes * (headcountGain + roleGain);
  }, 0);
}

export function calculateFutureCoverageClosureRisk({
  slotStartMin,
  slotEndMin,
  candidateRoleIds,
  segmentNeeds,
}: {
  readonly slotStartMin: number;
  readonly slotEndMin: number;
  readonly candidateRoleIds: ReadonlySet<string>;
  readonly segmentNeeds: readonly SegmentCoverageNeed[];
}): number {
  return segmentNeeds.reduce((risk, segment) => {
    if (
      segment.missingHeadcount !== 1 ||
      slotStartMin > segment.startMin ||
      slotEndMin < segment.endMin
    ) {
      return risk;
    }

    return (
      risk +
      [...segment.missingRoleIds].filter(
        (roleId) => !candidateRoleIds.has(roleId)
      ).length
    );
  }, 0);
}

export function calculateDesiredWeeklyHoursScore({
  currentMinutes,
  slotMinutes,
  desiredHours,
  weight,
}: {
  readonly currentMinutes: number;
  readonly slotMinutes: number;
  readonly desiredHours: number | null;
  readonly weight: number;
}): number {
  if (!desiredHours || desiredHours <= 0) {
    return Math.round(weight / 2);
  }

  const desiredMinutes = desiredHours * 60;
  const currentDifference = Math.abs(desiredMinutes - currentMinutes);
  const nextDifference = Math.abs(
    desiredMinutes - currentMinutes - slotMinutes
  );
  const improvementRatio = Math.max(
    0,
    (currentDifference - nextDifference) / slotMinutes
  );
  const remainingMinutes = Math.max(0, desiredMinutes - currentMinutes);
  const remainingShiftRatio = Math.min(
    1,
    remainingMinutes / (slotMinutes * 3)
  );
  return Math.round(
    weight * (improvementRatio * 0.4 + remainingShiftRatio * 0.6)
  );
}

export function calculateDesiredWeeklyOverflowMinutes({
  currentMinutes,
  slotMinutes,
  desiredHours,
}: {
  readonly currentMinutes: number;
  readonly slotMinutes: number;
  readonly desiredHours: number | null;
}): number {
  if (!desiredHours || desiredHours <= 0) {
    return 0;
  }

  return Math.max(0, currentMinutes + slotMinutes - desiredHours * 60);
}

export function calculateDesiredDailyHoursFitScore({
  slotMinutes,
  desiredHours,
}: {
  readonly slotMinutes: number;
  readonly desiredHours: number | null;
}): number {
  if (!desiredHours || desiredHours <= 0) {
    return 15;
  }

  const desiredMinutes = desiredHours * 60;
  const difference = Math.abs(desiredMinutes - slotMinutes);
  if (difference <= 60) {
    return 30 - Math.round((difference / 60) * 15);
  }

  const mismatchRange = Math.max(1, desiredMinutes - 60);
  return Math.max(
    0,
    15 - Math.round(((difference - 60) / mismatchRange) * 15)
  );
}
