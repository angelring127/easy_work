import { NextRequest, NextResponse } from "next/server";
import { createClient, createPureClient } from "@/lib/supabase/server";

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
  jobRoleIds: Set<string>;
  difficultWeekdays: Set<number>;
  preferredWeekdays: Set<number>;
  priorityRank: number;
};

type AssignmentLike = {
  user_id: string;
  store_id: string;
  date: string;
  start_time: string;
  end_time: string;
  status?: string | null;
  work_items?: { unpaid_break_min?: number | null } | null;
};

type Slot = {
  date: string;
  workItem: WorkItem;
  startMin: number;
  endMin: number;
  unpaidBreakMin: number;
  isOpening: boolean;
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

function getBusinessHourForDate(
  businessHours: Array<Record<string, any>>,
  date: string
) {
  const weekday = getWeekday(date);
  return businessHours.find(
    (hour) => hour.weekday === weekday || hour.day_of_week === weekday
  );
}

function getBusinessOpenMin(
  businessHours: Array<Record<string, any>>,
  date: string
) {
  const businessHour = getBusinessHourForDate(businessHours, date);
  if (!businessHour) {
    return 540;
  }
  return businessHour.open_min ?? 540;
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

function getShiftCounts(
  assignments: AssignmentLike[],
  date: string,
  boundaryMin: number
) {
  let morning = 0;
  let afternoon = 0;

  assignments.forEach((assignment) => {
    if (assignment.date !== date || assignment.status === "CANCELLED") {
      return;
    }

    const startMin = timeToMinutes(assignment.start_time);
    const endMin = timeToMinutes(assignment.end_time);

    if (startMin < boundaryMin) {
      morning += 1;
    }
    if (endMin > boundaryMin) {
      afternoon += 1;
    }
  });

  return { morning, afternoon };
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
  const nextWeeklyHours =
    ((weeklyMinutes.get(candidate.id) || 0) + slotPaidMin) / 60;

  let conditionScore = 0;
  conditionPriorities.forEach((condition) => {
    if (condition.conditionKey === "desired_weekly_hours") {
      if (!candidate.desiredWeeklyHours || candidate.desiredWeeklyHours <= 0) {
        return;
      }

      if (nextWeeklyHours <= candidate.desiredWeeklyHours) {
        const closeness =
          1 -
          Math.min(
            candidate.desiredWeeklyHours,
            Math.abs(candidate.desiredWeeklyHours - nextWeeklyHours)
          ) /
            candidate.desiredWeeklyHours;
        conditionScore += Math.round(condition.weight * Math.max(0, closeness));
      }
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
      businessHoursResult,
      workItemsResult,
      conditionResult,
      userPriorityResult,
      openingPolicyResult,
      openingWorkItemsResult,
      storeUsersResult,
      userJobRolesResult,
      availabilityResult,
      weekdayPrefsResult,
    ] = await Promise.all([
      db.from("stores").select("*").eq("id", storeId).single(),
      db.from("store_business_hours").select("*").eq("store_id", storeId),
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
        .from("store_auto_schedule_opening_policies")
        .select("*")
        .eq("store_id", storeId)
        .maybeSingle(),
      db
        .from("store_auto_schedule_opening_work_items")
        .select("work_item_id")
        .eq("store_id", storeId),
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
    ]);

    const firstError =
      storeResult.error ||
      businessHoursResult.error ||
      workItemsResult.error ||
      (isMissingSettingsTableError(conditionResult.error)
        ? null
        : conditionResult.error) ||
      (isMissingSettingsTableError(userPriorityResult.error)
        ? null
        : userPriorityResult.error) ||
      (isMissingSettingsTableError(openingPolicyResult.error)
        ? null
        : openingPolicyResult.error) ||
      (isMissingSettingsTableError(openingWorkItemsResult.error)
        ? null
        : openingWorkItemsResult.error) ||
      storeUsersResult.error ||
      userJobRolesResult.error ||
      availabilityResult.error ||
      weekdayPrefsResult.error;

    if (firstError) {
      return NextResponse.json(
        { success: false, error: firstError.message },
        { status: 500 }
      );
    }

    const store = storeResult.data || {};
    const workItems = (workItemsResult.data || []) as WorkItem[];
    if (workItems.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          created: 0,
          skipped: dates.length,
          warnings: ["No work items configured"],
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

    const openingPolicy =
      !openingPolicyResult.error && openingPolicyResult.data
        ? openingPolicyResult.data
        : {
      enabled: true,
      start_source: "business_open",
      custom_start_min: null,
      end_min: 660,
      required_headcount: 1,
      failure_mode: "warn_and_continue",
    };
    const explicitOpeningItemIds = new Set(
      (openingWorkItemsResult.error
        ? []
        : openingWorkItemsResult.data || []
      ).map((row: any) => row.work_item_id)
    );
    const openingItemIds =
      explicitOpeningItemIds.size > 0
        ? explicitOpeningItemIds
        : new Set(
            workItems
              .filter((item) => item.name.toLowerCase().includes("opening"))
              .map((item) => item.id)
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

    const difficultByUser = new Map<string, Set<number>>();
    const preferredByUser = new Map<string, Set<number>>();
    (weekdayPrefsResult.data || []).forEach((row: any) => {
      const targetMap = row.is_preferred ? difficultByUser : preferredByUser;
      const set = targetMap.get(row.user_id) || new Set<number>();
      set.add(row.weekday);
      targetMap.set(row.user_id, set);
    });

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
    const skipped: Array<{ date: string; workItemName: string; reason: string }> =
      [];

    const weeklyMinutes = new Map<string, number>();
    const monthlyMinutes = new Map<string, number>();
    const lastAssignedTime = new Map<string, number>();

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

    const canAssignSlotByStaffLimit = (slot: Slot) => {
      const currentCounts = getShiftCounts(scheduledAssignments, slot.date, boundaryMin);
      const touchesMorning = slot.startMin < boundaryMin;
      const touchesAfternoon = slot.endMin > boundaryMin;

      if (
        maxMorningStaff > 0 &&
        touchesMorning &&
        currentCounts.morning >= maxMorningStaff
      ) {
        return false;
      }

      if (
        maxAfternoonStaff > 0 &&
        touchesAfternoon &&
        currentCounts.afternoon >= maxAfternoonStaff
      ) {
        return false;
      }

      return true;
    };

    const assignSlot = (slot: Slot) => {
      if (!canAssignSlotByStaffLimit(slot)) {
        skipped.push({
          date: slot.date,
          workItemName: slot.workItem.name,
          reason: "staff_limit",
        });
        return;
      }

      const requiredRoles = requiredRolesByItem.get(slot.workItem.id) || new Set<string>();
      const slotPaidMin = paidMinutes(
        slot.startMin,
        slot.endMin,
        slot.unpaidBreakMin
      );
      const weekday = getWeekday(slot.date);

      const candidates = members.filter((candidate) => {
        if (!hasRequiredRole(candidate, requiredRoles)) {
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

      if (candidates.length === 0) {
        skipped.push({
          date: slot.date,
          workItemName: slot.workItem.name,
          reason: slot.isOpening ? "opening_no_candidate" : "no_candidate",
        });
        return;
      }

      const [selected] = candidates
        .map((candidate) => ({
          candidate,
          score: scoreCandidate({
            candidate,
            slot,
            weeklyMinutes,
            conditionPriorities,
            userPriorityCount: members.length,
          }),
        }))
        .sort((a, b) => {
          if (b.score !== a.score) {
            return b.score - a.score;
          }

          const weeklyDiff =
            (weeklyMinutes.get(a.candidate.id) || 0) -
            (weeklyMinutes.get(b.candidate.id) || 0);
          if (weeklyDiff !== 0) {
            return weeklyDiff;
          }

          const monthlyDiff =
            (monthlyMinutes.get(a.candidate.id) || 0) -
            (monthlyMinutes.get(b.candidate.id) || 0);
          if (monthlyDiff !== 0) {
            return monthlyDiff;
          }

          const lastAssignedDiff =
            (lastAssignedTime.get(a.candidate.id) || 0) -
            (lastAssignedTime.get(b.candidate.id) || 0);
          if (lastAssignedDiff !== 0) {
            return lastAssignedDiff;
          }

          return a.candidate.id.localeCompare(b.candidate.id);
        });

      const row = {
        store_id: storeId,
        user_id: selected.candidate.id,
        work_item_id: slot.workItem.id,
        date: slot.date,
        start_time: minutesToTime(slot.startMin),
        end_time: minutesToTime(slot.endMin),
        status: "ASSIGNED",
        created_by: authUser.user!.id,
      };

      chosen.push(row);
      scheduledAssignments.push({
        ...row,
        work_items: { unpaid_break_min: slot.unpaidBreakMin },
      });
      weeklyMinutes.set(
        selected.candidate.id,
        (weeklyMinutes.get(selected.candidate.id) || 0) + slotPaidMin
      );
      monthlyMinutes.set(
        selected.candidate.id,
        (monthlyMinutes.get(selected.candidate.id) || 0) + slotPaidMin
      );
      lastAssignedTime.set(
        selected.candidate.id,
        parseDateKey(slot.date).getTime()
      );
    };

    dates.forEach((date) => {
      const openingItems = workItems.filter((item) => openingItemIds.has(item.id));
      const regularItems = workItems.filter((item) => !openingItemIds.has(item.id));

      if (openingPolicy.enabled && openingItems.length > 0) {
        const openingStart =
          openingPolicy.start_source === "custom" &&
          typeof openingPolicy.custom_start_min === "number"
            ? openingPolicy.custom_start_min
            : getBusinessOpenMin(businessHoursResult.data || [], date);
        const openingEnd =
          typeof openingPolicy.end_min === "number"
            ? openingPolicy.end_min
            : openingStart + 60;
        const openingWorkItem = openingItems[0];

        for (let i = 0; i < Number(openingPolicy.required_headcount || 1); i++) {
          assignSlot({
            date,
            workItem: openingWorkItem,
            startMin: openingStart,
            endMin: Math.max(openingStart + 1, openingEnd),
            unpaidBreakMin: 0,
            isOpening: true,
          });
        }
      }

      regularItems.forEach((workItem) => {
        assignSlot({
          date,
          workItem,
          startMin: workItem.start_min,
          endMin: workItem.end_min,
          unpaidBreakMin: workItem.unpaid_break_min || 0,
          isOpening: false,
        });
      });
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
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || "error" },
      { status: 500 }
    );
  }
}
