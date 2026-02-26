import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

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
  store_users?: { name?: string | null } | null;
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

  const queryFrom = week_from < month_from ? week_from : month_from;
  const queryTo = week_to > month_to ? week_to : month_to;

  const { data, error } = await supabase
    .from("schedule_assignments")
    .select(
      `
      user_id,
      date,
      start_time,
      end_time,
      work_items(unpaid_break_min),
      store_users(name)
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

  let weeklyTotalMin = 0;
  let monthlyTotalMin = 0;

  (data as AssignmentRow[] | null)?.forEach((row) => {
    const paidMinutes = calcPaidMinutes(row);
    const userId = row.user_id;
    const userName = row.store_users?.name?.trim() || userId;

    if (row.date >= week_from && row.date <= week_to) {
      weeklyTotalMin += paidMinutes;
      const prev = weeklyByUserMin.get(userId);
      if (prev) {
        prev.minutes += paidMinutes;
      } else {
        weeklyByUserMin.set(userId, { userName, minutes: paidMinutes });
      }
    }

    if (row.date >= month_from && row.date <= month_to) {
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
