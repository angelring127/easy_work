import { NextRequest, NextResponse } from "next/server";
import {
  createWorkItemSlots,
  type WorkItemSlot,
} from "@/lib/schedule/auto-schedule-slots";
import {
  calculateDesiredDailyHoursFitScore,
  calculateDesiredWeeklyHoursScore,
  calculateDesiredWeeklyOverflowMinutes,
  calculateFutureCoverageClosureRisk,
  calculateFutureCoverageGain,
  compareOperatingAssignmentChoices,
} from "@/lib/schedule/assignment-ranking";
import { loadOperatingPatterns } from "@/lib/schedule/operating-pattern-settings";
import {
  calculateWorkItemOverflowMinutes,
  evaluateOperatingSegmentCoverage,
} from "@/lib/schedule/operating-patterns";
import {
  evaluateRoleAllocationCandidate,
  findMostConstrainedRoleIds,
} from "@/lib/schedule/role-allocation";
import { wouldExceedConcurrentStaffLimit } from "@/lib/schedule/staff-limits";
import { groupLegacyUserWeekdayPreferences } from "@/lib/schedule/weekday-preferences";
import { createClient, createPureClient } from "@/lib/supabase/server";
import type { OperatingPatternPayload } from "@/lib/validations/schedule/operating-patterns";

type ConditionKey =
  | "desired_weekly_hours"
  | "day_off_preference"
  | "preferred_weekday";

type WorkItem = {
  id: string;
  name: string;
  start_min: number;
  end_min: number;
  unpaid_break_min: number | null;
  max_headcount: number | null;
};

type StoreMember = {
  id: string;
  user_id: string | null;
  name: string | null;
  role: string;
  is_guest: boolean | null;
  metadata?: Record<string, unknown> | null;
};

type Candidate = StoreMember & {
  desiredWeeklyHours: number | null;
  desiredDailyHours: number | null;
  jobRoleIds: Set<string>;
  difficultWeekdays: Set<number>;
  preferredWeekdays: Set<number>;
  priorityRank: number;
};

type AssignmentLike = {
  user_id: string;
  store_id: string;
  work_item_id?: string | null;
  date: string;
  start_time: string;
  end_time: string;
  status?: string | null;
  work_items?: { unpaid_break_min?: number | null } | null;
};

type CandidateEvaluation = {
  readonly candidate: Candidate;
  readonly roleAllocation: ReturnType<typeof evaluateRoleAllocationCandidate>;
  readonly desiredWeeklyOverflowMinutes: number;
  readonly dailyHoursFitScore: number;
  readonly preferenceScore: number;
  readonly weeklyMinutes: number;
  readonly monthlyMinutes: number;
  readonly lastAssignedTime: number;
};

type Slot = WorkItemSlot<WorkItem>;

type UnmetOperatingSegment = {
  date: string;
  patternId: string;
  patternName: string;
  segmentId: string;
  segmentName: string;
  startMin: number;
  endMin: number;
  requiredHeadcount: number;
  assignedHeadcount: number;
  missingRoleIds: string[];
  missingRoleNames: string[];
};

const defaultConditionPriorities = [
  { conditionKey: "desired_weekly_hours" as const, priorityRank: 1, weight: 30 },
  { conditionKey: "day_off_preference" as const, priorityRank: 2, weight: 20 },
  { conditionKey: "preferred_weekday" as const, priorityRank: 3, weight: 10 },
];

function toDateKey(date: Date) {
  return date.toISOString().split("T")[0];
}

function parseDateKey(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getWeekday(date: string) {
  return parseDateKey(date).getDay();
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getDates(from: string, to: string, targetDate?: string | null) {
  if (targetDate) {
    return [targetDate];
  }

  const dates: string[] = [];
  for (
    let cursor = parseDateKey(from);
    cursor <= parseDateKey(to);
    cursor = addDays(cursor, 1)
  ) {
    dates.push(toDateKey(cursor));
  }
  return dates;
}

function minutesToTime(minutes: number) {
  const safeMinutes = Math.max(0, Math.min(1440, minutes));
  const hour = Math.floor(safeMinutes / 60);
  const minute = safeMinutes % 60;
  return `${hour.toString().padStart(2, "0")}:${minute
    .toString()
    .padStart(2, "0")}`;
}

function timeToMinutes(time: string) {
  const [hour = "0", minute = "0"] = time.split(":");
  return Number(hour) * 60 + Number(minute);
}

function paidMinutes(startMin: number, endMin: number, unpaidBreakMin = 0) {
  return Math.max(0, endMin - startMin - unpaidBreakMin);
}

function assignmentPaidMinutes(assignment: AssignmentLike) {
  return paidMinutes(
    timeToMinutes(assignment.start_time),
    timeToMinutes(assignment.end_time),
    assignment.work_items?.unpaid_break_min || 0
  );
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

function monthRange(from: string, to: string) {
  const start = parseDateKey(from);
  const end = parseDateKey(to);
  const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
  const monthEnd = new Date(end.getFullYear(), end.getMonth() + 1, 0);
  return { from: toDateKey(monthStart), to: toDateKey(monthEnd) };
}

function normalizeConditions(
  rows:
    | Array<{
        condition_key: ConditionKey;
        priority_rank: number;
        weight: number;
      }>
    | null
    | undefined
) {
  if (!rows || rows.length === 0) {
    return defaultConditionPriorities;
  }

  const byKey = new Map(
    rows.map((row) => [
      row.condition_key,
      {
        conditionKey: row.condition_key,
        priorityRank: row.priority_rank,
        weight: row.weight,
      },
    ])
  );

  return defaultConditionPriorities
    .map((fallback) => byKey.get(fallback.conditionKey) || fallback)
    .sort((a, b) => a.priorityRank - b.priorityRank);
}

function isMissingSettingsTableError(error: any) {
  if (!error) {
    return false;
  }

  const message = String(error.message || "");
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /does not exist|schema cache/i.test(message)
  );
}

function hasRequiredRole(candidate: Candidate, requiredRoles: Set<string>) {
  if (requiredRoles.size === 0) {
    return true;
  }

  for (const roleId of requiredRoles) {
    if (candidate.jobRoleIds.has(roleId)) {
      return true;
    }
  }

  return false;
}

function isUnavailable(
  availabilityByUserDate: Map<string, Array<Record<string, any>>>,
  userId: string,
  date: string,
  startMin: number,
  endMin: number
) {
  const rows = availabilityByUserDate.get(`${userId}:${date}`) || [];
  return rows.some((row) => {
    if (!row.has_time_restriction) {
      return true;
    }

    if (!row.start_time || !row.end_time) {
      return true;
    }

    return overlaps(startMin, endMin, timeToMinutes(row.start_time), timeToMinutes(row.end_time));
  });
}

function hasAssignmentConflict(
  assignments: AssignmentLike[],
  userId: string,
  date: string,
  startMin: number,
  endMin: number
) {
  return assignments.some(
    (assignment) =>
      assignment.user_id === userId &&
      assignment.date === date &&
      assignment.status !== "CANCELLED" &&
      overlaps(
        startMin,
        endMin,
        timeToMinutes(assignment.start_time),
        timeToMinutes(assignment.end_time)
      )
  );
}

function hasAnyAssignmentOnDate(
  assignments: AssignmentLike[],
  userId: string,
  date: string
) {
  return assignments.some(
    (assignment) =>
      assignment.user_id === userId &&
      assignment.date === date &&
      assignment.status !== "CANCELLED"
  );
}

function scoreCandidate({
  candidate,
  slot,
  weeklyMinutes,
  conditionPriorities,
  userPriorityCount,
}: {
  candidate: Candidate;
  slot: Slot;
  weeklyMinutes: Map<string, number>;
  conditionPriorities: ReturnType<typeof normalizeConditions>;
  userPriorityCount: number;
}) {
  const weekday = getWeekday(slot.date);
  const slotPaidMin = paidMinutes(
    slot.startMin,
    slot.endMin,
    slot.unpaidBreakMin
  );
  let conditionScore = 0;
  conditionPriorities.forEach((condition) => {
    if (condition.conditionKey === "desired_weekly_hours") {
      conditionScore += calculateDesiredWeeklyHoursScore({
        currentMinutes: weeklyMinutes.get(candidate.id) || 0,
        slotMinutes: slotPaidMin,
        desiredHours: candidate.desiredWeeklyHours,
        weight: condition.weight,
      });
      return;
    }

    if (condition.conditionKey === "day_off_preference") {
      conditionScore += condition.weight;
      return;
    }

    if (
      condition.conditionKey === "preferred_weekday" &&
      candidate.preferredWeekdays.has(weekday)
    ) {
      conditionScore += condition.weight;
    }
  });

  const userPriorityScore =
    userPriorityCount <= 1
      ? 10
      : Math.round(
          ((userPriorityCount - candidate.priorityRank) /
            (userPriorityCount - 1)) *
            10
        );

  return conditionScore + userPriorityScore;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const db = supabase as any;

  const { searchParams } = new URL(request.url);
  const storeId = searchParams.get("store_id");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const targetUserId = searchParams.get("user_id");
  const targetDate = searchParams.get("date");

  if (!storeId || !from || !to) {
    return NextResponse.json(
      { success: false, error: "store_id, from, to are required" },
      { status: 400 }
    );
  }

  const { data: authUser, error: authError } = await supabase.auth.getUser();
  if (authError || !authUser.user) {
    return NextResponse.json(
      { success: false, error: "unauthorized" },
      { status: 401 }
    );
  }
  const authenticatedUserId = authUser.user.id;

  const { data: role, error: roleError } = await db
    .from("user_store_roles")
    .select("role")
    .eq("store_id", storeId)
    .eq("user_id", authUser.user.id)
    .eq("status", "ACTIVE")
    .single();

  if (
    roleError ||
    !role ||
    !["MASTER", "SUB", "SUB_MANAGER"].includes(role.role)
  ) {
    return NextResponse.json(
      { success: false, error: "Insufficient permissions" },
      { status: 403 }
    );
  }

  try {
    const dates = getDates(from, to, targetDate);
    const { from: monthFrom, to: monthTo } = monthRange(from, to);

    const [
      storeResult,
      workItemsResult,
      conditionResult,
      userPriorityResult,
      storeUsersResult,
      userJobRolesResult,
      availabilityResult,
      weekdayPrefsResult,
      storeJobRolesResult,
    ] = await Promise.all([
      db.from("stores").select("*").eq("id", storeId).single(),
      db
        .from("work_items")
        .select("id, name, start_min, end_min, unpaid_break_min, max_headcount")
        .eq("store_id", storeId)
        .order("start_min"),
      db
        .from("store_auto_schedule_condition_priorities")
        .select("condition_key, priority_rank, weight")
        .eq("store_id", storeId)
        .order("priority_rank"),
      db
        .from("store_auto_schedule_user_priorities")
        .select("user_id, priority_rank")
        .eq("store_id", storeId)
        .order("priority_rank"),
      db
        .from("store_users")
        .select("id, user_id, name, role, is_guest, is_active, metadata")
        .eq("store_id", storeId)
        .eq("is_active", true),
      db
        .from("user_store_job_roles")
        .select("user_id, job_role_id")
        .eq("store_id", storeId),
      db
        .from("user_availability")
        .select("user_id, date, has_time_restriction, start_time, end_time")
        .eq("store_id", storeId)
        .gte("date", from)
        .lte("date", to),
      db
        .from("user_difficult_weekdays")
        .select("user_id, weekday, is_preferred")
        .eq("store_id", storeId),
      db
        .from("store_job_roles")
        .select("id, name")
        .eq("store_id", storeId)
        .eq("active", true),
    ]);

    const firstError =
      storeResult.error ||
      workItemsResult.error ||
      (isMissingSettingsTableError(conditionResult.error)
        ? null
        : conditionResult.error) ||
      (isMissingSettingsTableError(userPriorityResult.error)
        ? null
        : userPriorityResult.error) ||
      storeUsersResult.error ||
      userJobRolesResult.error ||
      availabilityResult.error ||
      weekdayPrefsResult.error ||
      storeJobRolesResult.error;

    if (firstError) {
      return NextResponse.json(
        { success: false, error: firstError.message },
        { status: 500 }
      );
    }

    const store = storeResult.data || {};
    const workItems = (workItemsResult.data || []) as WorkItem[];
    let operatingPatterns: OperatingPatternPayload[] = [];
    try {
      operatingPatterns = await loadOperatingPatterns(supabase, storeId);
    } catch (error) {
      if (!isMissingSettingsTableError(error)) {
        throw error;
      }
    }
    if (workItems.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          created: 0,
          skipped: dates.length,
          warnings: ["No work items configured"],
          unmetSegments: [],
        },
      });
    }

    const requiredRolesQuery = await db
      .from("work_item_required_roles")
      .select("work_item_id, job_role_id")
      .in(
        "work_item_id",
        workItems.map((item) => item.id)
      );
    if (requiredRolesQuery.error) {
      return NextResponse.json(
        { success: false, error: requiredRolesQuery.error.message },
        { status: 500 }
      );
    }

    const adminDb = (await createPureClient()) as any;
    const userIds = ((storeUsersResult.data || []) as StoreMember[]).map(
      (member) => member.id
    );

    const existingResult = await adminDb
      .from("schedule_assignments")
      .select(
        `
        store_id,
        user_id,
        work_item_id,
        date,
        start_time,
        end_time,
        status,
        work_items(unpaid_break_min)
      `
      )
      .in("user_id", userIds.length > 0 ? userIds : ["00000000-0000-0000-0000-000000000000"])
      .gte("date", monthFrom)
      .lte("date", monthTo);

    if (existingResult.error) {
      return NextResponse.json(
        { success: false, error: existingResult.error.message },
        { status: 500 }
      );
    }

    const authUsers = await adminDb.auth.admin.listUsers();
    const authUserMeta = new Map<string, Record<string, any>>();
    if (!authUsers.error) {
      authUsers.data.users.forEach((user: any) => {
        authUserMeta.set(user.id, user.user_metadata || {});
      });
    }

    const conditionPriorities = normalizeConditions(
      conditionResult.error ? [] : conditionResult.data
    );
    const userPriorityRank = new Map(
      (userPriorityResult.error ? [] : userPriorityResult.data || []).map((row: any) => [
        row.user_id,
        row.priority_rank,
      ])
    );

    const jobRolesByUser = new Map<string, Set<string>>();
    (userJobRolesResult.data || []).forEach((row: any) => {
      const roles = jobRolesByUser.get(row.user_id) || new Set<string>();
      roles.add(row.job_role_id);
      jobRolesByUser.set(row.user_id, roles);
    });

    const requiredRolesByItem = new Map<string, Set<string>>();
    (requiredRolesQuery.data || []).forEach((row: any) => {
      const roles =
        requiredRolesByItem.get(row.work_item_id) || new Set<string>();
      roles.add(row.job_role_id);
      requiredRolesByItem.set(row.work_item_id, roles);
    });

    const { difficultByUser, preferredByUser } =
      groupLegacyUserWeekdayPreferences(weekdayPrefsResult.data || []);

    const availabilityByUserDate = new Map<string, Array<Record<string, any>>>();
    (availabilityResult.data || []).forEach((row: any) => {
      const key = `${row.user_id}:${row.date}`;
      const rows = availabilityByUserDate.get(key) || [];
      rows.push(row);
      availabilityByUserDate.set(key, rows);
    });

    const members = ((storeUsersResult.data || []) as StoreMember[])
      .filter((member) => !targetUserId || member.id === targetUserId)
      .map((member, index) => {
        const metadata = member.is_guest
          ? member.metadata || {}
          : member.user_id
          ? authUserMeta.get(member.user_id) || {}
          : {};

        return {
          ...member,
          desiredWeeklyHours:
            typeof metadata.desired_weekly_hours === "number"
              ? metadata.desired_weekly_hours
              : null,
          desiredDailyHours:
            typeof metadata.desired_daily_hours === "number"
              ? metadata.desired_daily_hours
              : null,
          jobRoleIds: jobRolesByUser.get(member.id) || new Set<string>(),
          difficultWeekdays: difficultByUser.get(member.id) || new Set<number>(),
          preferredWeekdays: preferredByUser.get(member.id) || new Set<number>(),
          priorityRank:
            Number(userPriorityRank.get(member.id)) ||
            userIds.length + index + 1,
        };
      })
      .sort((a, b) => Number(a.priorityRank) - Number(b.priorityRank)) as Candidate[];

    const existingAssignments = (existingResult.data || []) as AssignmentLike[];
    const scheduledAssignments: AssignmentLike[] = [...existingAssignments];
    const chosen: Array<{
      store_id: string;
      user_id: string;
      work_item_id: string;
      date: string;
      start_time: string;
      end_time: string;
      status: string;
      created_by: string;
    }> = [];
    const warnings: string[] = [];
    const unmetSegments: UnmetOperatingSegment[] = [];
    const skipped: Array<{ date: string; workItemName: string; reason: string }> =
      [];

    const weeklyMinutes = new Map<string, number>();
    const monthlyMinutes = new Map<string, number>();
    const lastAssignedTime = new Map<string, number>();
    const workItemUsageCount = new Map<string, number>();

    existingAssignments.forEach((assignment) => {
      if (assignment.status === "CANCELLED") {
        return;
      }

      const minutes = assignmentPaidMinutes(assignment);
      if (assignment.date >= from && assignment.date <= to) {
        weeklyMinutes.set(
          assignment.user_id,
          (weeklyMinutes.get(assignment.user_id) || 0) + minutes
        );
        if (assignment.work_item_id) {
          workItemUsageCount.set(
            assignment.work_item_id,
            (workItemUsageCount.get(assignment.work_item_id) || 0) + 1
          );
        }
      }
      monthlyMinutes.set(
        assignment.user_id,
        (monthlyMinutes.get(assignment.user_id) || 0) + minutes
      );
      lastAssignedTime.set(
        assignment.user_id,
        Math.max(
          lastAssignedTime.get(assignment.user_id) || 0,
          parseDateKey(assignment.date).getTime()
        )
      );
    });

    const maxWeeklyMinutes = Math.max(0, Number(store.max_hours_per_week || 0)) * 60;
    const maxMonthlyMinutes =
      Math.max(0, Number(store.max_hours_per_month || 0)) * 60;
    const boundaryMin = Number(store.shift_boundary_time_min || 720);
    const maxMorningStaff = Number(store.max_morning_staff || 0);
    const maxAfternoonStaff = Number(store.max_afternoon_staff || 0);
    const roleMemberCounts = new Map<string, number>();
    members.forEach((member) =>
      member.jobRoleIds.forEach((roleId) =>
        roleMemberCounts.set(roleId, (roleMemberCounts.get(roleId) || 0) + 1)
      )
    );
    const roleDemandCounts = new Map<string, number>();
    dates.forEach((date) => {
      const pattern = operatingPatterns.find(
        (candidatePattern) =>
          candidatePattern.isActive &&
          candidatePattern.weekdays.includes(getWeekday(date))
      );
      pattern?.segments.forEach((segment) =>
        segment.requiredRoleIds.forEach((roleId) =>
          roleDemandCounts.set(roleId, (roleDemandCounts.get(roleId) || 0) + 1)
        )
      );
    });
    const reservableRoleIds = findMostConstrainedRoleIds({
      roleDemandCounts,
      roleMemberCounts,
    });
    const reservableRoleIdsByDate = new Map<string, Set<string>>();
    dates.forEach((date, dateIndex) => {
      const futureRequiredRoleIds = new Set<string>();
      dates.slice(dateIndex + 1).forEach((futureDate) => {
        const futurePattern = operatingPatterns.find(
          (candidatePattern) =>
            candidatePattern.isActive &&
            candidatePattern.weekdays.includes(getWeekday(futureDate))
        );
        futurePattern?.segments.forEach((segment) =>
          segment.requiredRoleIds.forEach((roleId) =>
            futureRequiredRoleIds.add(roleId)
          )
        );
      });
      reservableRoleIdsByDate.set(
        date,
        new Set(
          [...reservableRoleIds].filter((roleId) =>
            futureRequiredRoleIds.has(roleId)
          )
        )
      );
    });

    const canAssignSlotByStaffLimit = (slot: Slot) => {
      const assignments = scheduledAssignments
        .filter(
          (assignment) =>
            assignment.date === slot.date && assignment.status !== "CANCELLED"
        )
        .map((assignment) => ({
          startMin: timeToMinutes(assignment.start_time),
          endMin: timeToMinutes(assignment.end_time),
        }));

      return !wouldExceedConcurrentStaffLimit({
        assignments,
        proposedSlot: { startMin: slot.startMin, endMin: slot.endMin },
        boundaryMin,
        maxMorningStaff,
        maxAfternoonStaff,
      });
    };

    const getCandidateEvaluations = (
      slot: Slot,
      preferredRoleIds: Set<string> = new Set<string>(),
      requirePreferredRole = false,
      remainingHeadcount = 1
    ): CandidateEvaluation[] => {
      if (!canAssignSlotByStaffLimit(slot)) {
        return [];
      }

      const requiredRoles = requiredRolesByItem.get(slot.workItem.id) || new Set<string>();
      const slotPaidMin = paidMinutes(
        slot.startMin,
        slot.endMin,
        slot.unpaidBreakMin
      );
      const weekday = getWeekday(slot.date);

      const candidates = members.filter((candidate) => {
        if (hasAnyAssignmentOnDate(scheduledAssignments, candidate.id, slot.date)) {
          return false;
        }

        if (!hasRequiredRole(candidate, requiredRoles)) {
          return false;
        }

        if (
          requirePreferredRole &&
          ![...preferredRoleIds].some((roleId) =>
            candidate.jobRoleIds.has(roleId)
          )
        ) {
          return false;
        }

        if (candidate.difficultWeekdays.has(weekday)) {
          return false;
        }

        if (
          isUnavailable(
            availabilityByUserDate,
            candidate.id,
            slot.date,
            slot.startMin,
            slot.endMin
          )
        ) {
          return false;
        }

        if (
          hasAssignmentConflict(
            scheduledAssignments,
            candidate.id,
            slot.date,
            slot.startMin,
            slot.endMin
          )
        ) {
          return false;
        }

        const nextWeekly = (weeklyMinutes.get(candidate.id) || 0) + slotPaidMin;
        const nextMonthly = (monthlyMinutes.get(candidate.id) || 0) + slotPaidMin;

        if (maxWeeklyMinutes > 0 && nextWeekly > maxWeeklyMinutes) {
          return false;
        }

        if (maxMonthlyMinutes > 0 && nextMonthly > maxMonthlyMinutes) {
          return false;
        }

        return true;
      });

      return candidates.map((candidate) => ({
        candidate,
        roleAllocation: evaluateRoleAllocationCandidate({
          candidateRoleIds: candidate.jobRoleIds,
          otherCandidateRoleIds: candidates
            .filter((other) => other.id !== candidate.id)
            .map((other) => other.jobRoleIds),
          missingRoleIds: preferredRoleIds,
          remainingHeadcount,
          reservableRoleIds:
            reservableRoleIdsByDate.get(slot.date) || new Set<string>(),
          roleMemberCounts,
        }),
        desiredWeeklyOverflowMinutes:
          calculateDesiredWeeklyOverflowMinutes({
            currentMinutes: weeklyMinutes.get(candidate.id) || 0,
            slotMinutes: slotPaidMin,
            desiredHours: candidate.desiredWeeklyHours,
          }),
        dailyHoursFitScore: calculateDesiredDailyHoursFitScore({
          slotMinutes: slotPaidMin,
          desiredHours: candidate.desiredDailyHours,
        }),
        preferenceScore: scoreCandidate({
          candidate,
          slot,
          weeklyMinutes,
          conditionPriorities,
          userPriorityCount: members.length,
        }),
        weeklyMinutes: weeklyMinutes.get(candidate.id) || 0,
        monthlyMinutes: monthlyMinutes.get(candidate.id) || 0,
        lastAssignedTime: lastAssignedTime.get(candidate.id) || 0,
      }));
    };

    const commitAssignment = (slot: Slot, candidate: Candidate) => {
      const slotPaidMin = paidMinutes(
        slot.startMin,
        slot.endMin,
        slot.unpaidBreakMin
      );
      const row = {
        store_id: storeId,
        user_id: candidate.id,
        work_item_id: slot.workItem.id,
        date: slot.date,
        start_time: minutesToTime(slot.startMin),
        end_time: minutesToTime(slot.endMin),
        status: "ASSIGNED",
        created_by: authenticatedUserId,
      };

      chosen.push(row);
      scheduledAssignments.push({
        ...row,
        work_items: { unpaid_break_min: slot.unpaidBreakMin },
      });
      weeklyMinutes.set(
        candidate.id,
        (weeklyMinutes.get(candidate.id) || 0) + slotPaidMin
      );
      monthlyMinutes.set(
        candidate.id,
        (monthlyMinutes.get(candidate.id) || 0) + slotPaidMin
      );
      lastAssignedTime.set(
        candidate.id,
        parseDateKey(slot.date).getTime()
      );
      workItemUsageCount.set(
        slot.workItem.id,
        (workItemUsageCount.get(slot.workItem.id) || 0) + 1
      );
    };

    const assignSlot = (
      slot: Slot,
      preferredRoleIds: Set<string> = new Set<string>(),
      requirePreferredRole = false,
      recordFailure = true,
      remainingHeadcount = 1
    ) => {
      const evaluations = getCandidateEvaluations(
        slot,
        preferredRoleIds,
        requirePreferredRole,
        remainingHeadcount
      );
      const [selected] = evaluations
        .map((evaluation) => ({
          ...evaluation,
          candidateId: evaluation.candidate.id,
          workItemId: slot.workItem.id,
          futureCoverageClosureRisk: 0,
          futureCoverageGain: 0,
          workItemUsageCount: workItemUsageCount.get(slot.workItem.id) || 0,
          overflowMinutes: 0,
        }))
        .sort(compareOperatingAssignmentChoices);

      if (!selected) {
        if (recordFailure) {
          skipped.push({
            date: slot.date,
            workItemName: slot.workItem.name,
            reason: canAssignSlotByStaffLimit(slot)
              ? "no_candidate"
              : "staff_limit",
          });
        }
        return false;
      }

      commitAssignment(slot, selected.candidate);
      return true;
    };

    const roleNameById = new Map<string, string>(
      (storeJobRolesResult.data || []).map(
        (row: { id: string; name: string }) => [row.id, row.name]
      )
    );
    const patternByWeekday = new Map<number, OperatingPatternPayload>();
    operatingPatterns
      .filter((pattern) => pattern.isActive)
      .forEach((pattern) =>
        pattern.weekdays.forEach((weekday) =>
          patternByWeekday.set(weekday, pattern)
        )
      );

    const getSegmentCoverage = (
      date: string,
      segment: OperatingPatternPayload["segments"][number]
    ) =>
      evaluateOperatingSegmentCoverage(segment, scheduledAssignments
        .filter(
          (assignment) =>
            assignment.store_id === storeId &&
            assignment.date === date &&
            assignment.status !== "CANCELLED"
        )
        .map((assignment) => ({
          userId: assignment.user_id,
          startMin: timeToMinutes(assignment.start_time),
          endMin: timeToMinutes(assignment.end_time),
          roleIds: jobRolesByUser.get(assignment.user_id) || [],
        }))
      );

    const assignOperatingPattern = (
      date: string,
      pattern: OperatingPatternPayload
    ) => {
      const segments = [...pattern.segments].sort(
        (left, right) => left.startMin - right.startMin
      );

      segments.forEach((segment) => {
        const coveringItems = workItems
          .map((workItem) => ({
            workItem,
            overflowMinutes: calculateWorkItemOverflowMinutes(
              workItem.start_min,
              workItem.end_min,
              segment.startMin,
              segment.endMin
            ),
          }))
          .filter(
            (
              item
            ): item is { workItem: WorkItem; overflowMinutes: number } =>
              item.overflowMinutes !== null
          )
          .sort((left, right) => left.overflowMinutes - right.overflowMinutes);

        let attempts = 0;
        while (attempts < members.length) {
          const coverage = getSegmentCoverage(date, segment);
          if (coverage.isSatisfied) {
            break;
          }

          const missingRoleIds = new Set(coverage.missingRoleIds);
          const requireMissingRole =
            coverage.assignedHeadcount >= segment.minHeadcount &&
            missingRoleIds.size > 0;
          const remainingHeadcount = Math.max(
            0,
            segment.minHeadcount - coverage.assignedHeadcount
          );
          const segmentNeeds = segments.map((candidateSegment) => {
            const candidateCoverage = getSegmentCoverage(
              date,
              candidateSegment
            );
            return {
              startMin: candidateSegment.startMin,
              endMin: candidateSegment.endMin,
              missingHeadcount: Math.max(
                0,
                candidateSegment.minHeadcount -
                  candidateCoverage.assignedHeadcount
              ),
              missingRoleIds: new Set(candidateCoverage.missingRoleIds),
            };
          });
          const choices = coveringItems.flatMap((item) => {
            const slot = {
              date,
              workItem: item.workItem,
              startMin: item.workItem.start_min,
              endMin: item.workItem.end_min,
              unpaidBreakMin: item.workItem.unpaid_break_min || 0,
            };
            return getCandidateEvaluations(
              slot,
              missingRoleIds,
              requireMissingRole,
              remainingHeadcount
            ).map((evaluation) => ({
              ...evaluation,
              slot,
              candidateId: evaluation.candidate.id,
              workItemId: item.workItem.id,
              futureCoverageClosureRisk:
                calculateFutureCoverageClosureRisk({
                  slotStartMin: slot.startMin,
                  slotEndMin: slot.endMin,
                  candidateRoleIds: evaluation.candidate.jobRoleIds,
                  segmentNeeds,
                }),
              futureCoverageGain: calculateFutureCoverageGain({
                slotStartMin: slot.startMin,
                slotEndMin: slot.endMin,
                candidateRoleIds: evaluation.candidate.jobRoleIds,
                segmentNeeds,
              }),
              workItemUsageCount:
                workItemUsageCount.get(item.workItem.id) || 0,
              overflowMinutes: item.overflowMinutes,
            }));
          });
          const [selected] = choices.sort(compareOperatingAssignmentChoices);

          if (!selected) {
            break;
          }
          commitAssignment(selected.slot, selected.candidate);
          attempts += 1;
        }

        const coverage = getSegmentCoverage(date, segment);
        if (!coverage.isSatisfied) {
          unmetSegments.push({
            date,
            patternId: pattern.id,
            patternName: pattern.name,
            segmentId: segment.id,
            segmentName: segment.name,
            startMin: segment.startMin,
            endMin: segment.endMin,
            requiredHeadcount: segment.minHeadcount,
            assignedHeadcount: coverage.assignedHeadcount,
            missingRoleIds: coverage.missingRoleIds,
            missingRoleNames: coverage.missingRoleIds.map(
              (roleId) => roleNameById.get(roleId) || roleId
            ),
          });
        }
      });
    };

    dates.forEach((date) => {
      const operatingPattern = patternByWeekday.get(getWeekday(date));
      if (operatingPattern) {
        assignOperatingPattern(date, operatingPattern);
        return;
      }

      createWorkItemSlots(date, workItems).forEach((slot) => assignSlot(slot));
    });

    if (chosen.length > 0) {
      const { error: insertError } = await db
        .from("schedule_assignments")
        .insert(chosen);
      if (insertError) {
        return NextResponse.json(
          { success: false, error: insertError.message },
          { status: 500 }
        );
      }
    }

    skipped.forEach((item) => {
      warnings.push(`${item.date} ${item.workItemName}: ${item.reason}`);
    });

    return NextResponse.json({
      success: true,
      data: {
        created: chosen.length,
        skipped: skipped.length,
        warnings,
        unmetSegments,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || "error" },
      { status: 500 }
    );
  }
}
