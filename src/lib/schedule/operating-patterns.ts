export type OperatingPatternIssueCode =
  | "DUPLICATE_WEEKDAY"
  | "EMPTY_PATTERN_NAME"
  | "EMPTY_SEGMENT_NAME"
  | "INVALID_SEGMENT_TIME"
  | "INVALID_MIN_HEADCOUNT"
  | "OVERLAPPING_SEGMENTS"
  | "SEGMENT_GAP"
  | "MISSING_REQUIRED_ROLES";

export interface OperatingPatternSegmentInput {
  id: string;
  name: string;
  startMin: number;
  endMin: number;
  minHeadcount: number;
  requiredRoleIds: string[];
}

export interface OperatingPatternInput {
  id: string;
  name: string;
  weekdays: number[];
  segments: OperatingPatternSegmentInput[];
  isActive?: boolean;
}

export interface OperatingPatternValidationIssue {
  code: OperatingPatternIssueCode;
  severity: "error" | "warning";
  patternId: string;
  segmentId?: string;
  weekday?: number;
}

export interface SegmentCoverageTarget {
  startMin: number;
  endMin: number;
  minHeadcount: number;
  requiredRoleIds: string[];
}

export interface SegmentCoverageAssignment {
  userId: string;
  startMin: number;
  endMin: number;
  roleIds: Iterable<string>;
}

export interface SegmentCoverageResult {
  assignedHeadcount: number;
  missingRoleIds: string[];
  isSatisfied: boolean;
}

function isActive(pattern: OperatingPatternInput): boolean {
  return pattern.isActive !== false;
}

function findDuplicateWeekdayIssues(
  patterns: OperatingPatternInput[]
): OperatingPatternValidationIssue[] {
  const firstPatternByWeekday = new Map<number, string>();
  const issues: OperatingPatternValidationIssue[] = [];

  for (const pattern of patterns.filter(isActive)) {
    for (const weekday of new Set(pattern.weekdays)) {
      const firstPatternId = firstPatternByWeekday.get(weekday);
      if (firstPatternId && firstPatternId !== pattern.id) {
        issues.push({
          code: "DUPLICATE_WEEKDAY",
          severity: "error",
          patternId: pattern.id,
          weekday,
        });
      } else {
        firstPatternByWeekday.set(weekday, pattern.id);
      }
    }
  }

  return issues;
}

function findSegmentIssues(
  pattern: OperatingPatternInput
): OperatingPatternValidationIssue[] {
  const issues: OperatingPatternValidationIssue[] = [];
  const sortedSegments = [...pattern.segments].sort(
    (left, right) => left.startMin - right.startMin
  );

  for (const [index, segment] of sortedSegments.entries()) {
    if (!segment.name.trim()) {
      issues.push({
        code: "EMPTY_SEGMENT_NAME",
        severity: "error",
        patternId: pattern.id,
        segmentId: segment.id,
      });
    }
    if (
      segment.startMin < 0 ||
      segment.endMin > 1440 ||
      segment.startMin >= segment.endMin
    ) {
      issues.push({
        code: "INVALID_SEGMENT_TIME",
        severity: "error",
        patternId: pattern.id,
        segmentId: segment.id,
      });
    }
    if (!Number.isInteger(segment.minHeadcount) || segment.minHeadcount < 1) {
      issues.push({
        code: "INVALID_MIN_HEADCOUNT",
        severity: "error",
        patternId: pattern.id,
        segmentId: segment.id,
      });
    }
    if (segment.requiredRoleIds.length === 0) {
      issues.push({
        code: "MISSING_REQUIRED_ROLES",
        severity: "warning",
        patternId: pattern.id,
        segmentId: segment.id,
      });
    }

    const previous = sortedSegments[index - 1];
    if (!previous) {
      continue;
    }
    if (segment.startMin < previous.endMin) {
      issues.push({
        code: "OVERLAPPING_SEGMENTS",
        severity: "error",
        patternId: pattern.id,
        segmentId: segment.id,
      });
    } else if (segment.startMin > previous.endMin) {
      issues.push({
        code: "SEGMENT_GAP",
        severity: "warning",
        patternId: pattern.id,
        segmentId: segment.id,
      });
    }
  }

  return issues;
}

export function findOperatingPatternValidationIssues(
  patterns: OperatingPatternInput[]
): OperatingPatternValidationIssue[] {
  const issues = findDuplicateWeekdayIssues(patterns);

  for (const pattern of patterns) {
    if (!pattern.name.trim()) {
      issues.push({
        code: "EMPTY_PATTERN_NAME",
        severity: "error",
        patternId: pattern.id,
      });
    }
    issues.push(...findSegmentIssues(pattern));
  }

  return issues;
}

export function evaluateOperatingSegmentCoverage(
  segment: SegmentCoverageTarget,
  assignments: SegmentCoverageAssignment[]
): SegmentCoverageResult {
  const coveringAssignments = assignments.filter(
    (assignment) =>
      assignment.startMin <= segment.startMin &&
      assignment.endMin >= segment.endMin
  );
  const coveringUsers = new Set(
    coveringAssignments.map((assignment) => assignment.userId)
  );
  const coveredRoleIds = new Set<string>();

  for (const assignment of coveringAssignments) {
    for (const roleId of assignment.roleIds) {
      coveredRoleIds.add(roleId);
    }
  }

  const missingRoleIds = segment.requiredRoleIds.filter(
    (roleId) => !coveredRoleIds.has(roleId)
  );
  const assignedHeadcount = coveringUsers.size;

  return {
    assignedHeadcount,
    missingRoleIds,
    isSatisfied:
      assignedHeadcount >= segment.minHeadcount &&
      missingRoleIds.length === 0,
  };
}

export function calculateWorkItemOverflowMinutes(
  workItemStartMin: number,
  workItemEndMin: number,
  segmentStartMin: number,
  segmentEndMin: number
): number | null {
  if (
    workItemStartMin > segmentStartMin ||
    workItemEndMin < segmentEndMin
  ) {
    return null;
  }

  return (
    segmentStartMin - workItemStartMin + workItemEndMin - segmentEndMin
  );
}
