import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createPureClient } from "@/lib/supabase/server";

const QuerySchema = z.object({
  store_id: z.string().uuid(),
  week_from: z.string(),
  week_to: z.string(),
  month_from: z.string(),
  month_to: z.string(),
});

type AssignmentRow = {
  user_id: string;
  date: string;
  start_time: string;
  end_time: string;
  work_items?: { unpaid_break_min?: number | null } | null;
  store_users?: { name?: string | null; user_id?: string | null } | null;
};

const INCLUDED_STATUSES = ["ASSIGNED", "CONFIRMED"];

const parseMinutes = (time: string): number => {
  const [hourStr, minuteStr] = time.split(":");
  const hours = Number(hourStr);
  const minutes = Number(minuteStr);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return hours * 60 + minutes;
};

const calcPaidMinutes = (row: AssignmentRow): number => {
  const startMin = parseMinutes(row.start_time);
  let endMin = parseMinutes(row.end_time);
  if (endMin <= startMin) {
    endMin += 24 * 60;
  }
  const gross = endMin - startMin;
  const unpaidBreakMin = row.work_items?.unpaid_break_min || 0;
  return Math.max(0, gross - unpaidBreakMin);
};

const toOneDecimalHours = (minutes: number): number =>
  Math.round((minutes / 60) * 10) / 10;

const toDisplayId = (id: string): string => {
  const trimmed = id.trim();
  if (!trimmed) return id;
  // UUID인 경우 가독성을 위해 앞 8자리만 노출
  const uuidLike = /^[0-9a-fA-F-]{36}$/.test(trimmed);
  if (uuidLike) {
    return trimmed.split("-")[0];
  }
  return trimmed;
};

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const parsed = QuerySchema.safeParse({
    store_id: searchParams.get("store_id"),
    week_from: searchParams.get("week_from"),
    week_to: searchParams.get("week_to"),
    month_from: searchParams.get("month_from"),
    month_to: searchParams.get("month_to"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { store_id, week_from, week_to, month_from, month_to } = parsed.data;
  const todayStr = new Date().toISOString().split("T")[0];

  const { data: user, error: authError } = await supabase.auth.getUser();
  if (authError || !user.user) {
    return NextResponse.json(
      { success: false, error: "unauthorized" },
      { status: 401 }
    );
  }

  const { data: roleData, error: roleError } = await supabase
    .from("user_store_roles")
    .select("role")
    .eq("store_id", store_id)
    .eq("user_id", user.user.id)
    .eq("status", "ACTIVE")
    .single();

  if (roleError || !roleData) {
    return NextResponse.json(
      { success: false, error: "forbidden" },
      { status: 403 }
    );
  }

  const allowedRoles = new Set(["MASTER", "SUB_MANAGER", "SUB"]);
  if (!allowedRoles.has(roleData.role)) {
    return NextResponse.json(
      { success: false, error: "forbidden" },
      { status: 403 }
    );
  }

  const effectiveWeekTo = week_to < todayStr ? week_to : todayStr;
  const effectiveMonthTo = month_to < todayStr ? month_to : todayStr;
  const queryFrom = week_from < month_from ? week_from : month_from;
  const queryTo = effectiveWeekTo > effectiveMonthTo ? effectiveWeekTo : effectiveMonthTo;

  if (queryFrom > queryTo) {
    return NextResponse.json({
      success: true,
      data: {
        summary: {
          weeklyTotalHours: 0,
          monthlyTotalHours: 0,
        },
        weeklyByUser: [],
        monthlyByUser: [],
        period: {
          weekFrom: week_from,
          weekTo: week_to,
          monthFrom: month_from,
          monthTo: month_to,
        },
      },
    });
  }

  const { data, error } = await supabase
    .from("schedule_assignments")
    .select(
      `
      user_id,
      date,
      start_time,
      end_time,
      work_items(unpaid_break_min),
      store_users(name,user_id)
    `
    )
    .eq("store_id", store_id)
    .gte("date", queryFrom)
    .lte("date", queryTo)
    .in("status", INCLUDED_STATUSES);

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  const weeklyByUserMin = new Map<string, { userName: string; minutes: number }>();
  const monthlyByUserMin = new Map<string, { userName: string; minutes: number }>();
  const fallbackAuthIds = new Set<string>();
  const userIdToAuthId = new Map<string, string>();

  (data as AssignmentRow[] | null)?.forEach((row) => {
    const authId = row.store_users?.user_id?.trim();
    if (authId) {
      fallbackAuthIds.add(authId);
      userIdToAuthId.set(row.user_id, authId);
    }
  });

  const loginIdByAuthId = new Map<string, string>();
  if (fallbackAuthIds.size > 0) {
    const adminClient = await createPureClient();
    await Promise.all(
      Array.from(fallbackAuthIds).map(async (authId) => {
        const { data: userData, error: userError } =
          await adminClient.auth.admin.getUserById(authId);
        if (!userError && userData.user?.email) {
          loginIdByAuthId.set(authId, userData.user.email);
        }
      })
    );
  }

  let weeklyTotalMin = 0;
  let monthlyTotalMin = 0;

  (data as AssignmentRow[] | null)?.forEach((row) => {
    const paidMinutes = calcPaidMinutes(row);
    const userId = row.user_id;
    const displayName = row.store_users?.name?.trim();
    const authId = userIdToAuthId.get(userId);
    const loginId = authId ? loginIdByAuthId.get(authId) : undefined;
    const userName = displayName || loginId || toDisplayId(userId);

    if (row.date >= week_from && row.date <= effectiveWeekTo) {
      weeklyTotalMin += paidMinutes;
      const prev = weeklyByUserMin.get(userId);
      if (prev) {
        prev.minutes += paidMinutes;
      } else {
        weeklyByUserMin.set(userId, { userName, minutes: paidMinutes });
      }
    }

    if (row.date >= month_from && row.date <= effectiveMonthTo) {
      monthlyTotalMin += paidMinutes;
      const prev = monthlyByUserMin.get(userId);
      if (prev) {
        prev.minutes += paidMinutes;
      } else {
        monthlyByUserMin.set(userId, { userName, minutes: paidMinutes });
      }
    }
  });

  const weeklyByUser = Array.from(weeklyByUserMin.entries())
    .map(([userId, value]) => ({
      userId,
      userName: value.userName,
      hours: toOneDecimalHours(value.minutes),
    }))
    .sort((a, b) => b.hours - a.hours || a.userName.localeCompare(b.userName));

  const monthlyByUser = Array.from(monthlyByUserMin.entries())
    .map(([userId, value]) => ({
      userId,
      userName: value.userName,
      hours: toOneDecimalHours(value.minutes),
    }))
    .sort((a, b) => b.hours - a.hours || a.userName.localeCompare(b.userName));

  return NextResponse.json({
    success: true,
    data: {
      summary: {
        weeklyTotalHours: toOneDecimalHours(weeklyTotalMin),
        monthlyTotalHours: toOneDecimalHours(monthlyTotalMin),
      },
      weeklyByUser,
      monthlyByUser,
      period: {
        weekFrom: week_from,
        weekTo: week_to,
        monthFrom: month_from,
        monthTo: month_to,
      },
    },
  });
}
