import type { SupabaseClient } from "@supabase/supabase-js";

import type { OperatingPatternPayload } from "@/lib/validations/schedule/operating-patterns";

interface OperatingPatternRow {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
}

interface WeekdayRow {
  pattern_id: string;
  weekday: number;
}

interface SegmentRow {
  id: string;
  pattern_id: string;
  name: string;
  start_min: number;
  end_min: number;
  min_headcount: number;
  sort_order: number;
}

interface SegmentRoleRow {
  segment_id: string;
  job_role_id: string;
}

export function isOperatingPatternStorageMissing(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = "code" in error ? String(error.code) : "";
  const message = "message" in error ? String(error.message) : "";
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    /does not exist|schema cache/i.test(message)
  );
}

export async function loadOperatingPatterns(
  supabase: SupabaseClient,
  storeId: string
): Promise<OperatingPatternPayload[]> {
  const [patternsResult, weekdaysResult, segmentsResult, rolesResult] =
    await Promise.all([
      supabase
        .from("store_auto_schedule_operating_patterns")
        .select("id, name, is_active, sort_order")
        .eq("store_id", storeId)
        .order("sort_order"),
      supabase
        .from("store_auto_schedule_pattern_weekdays")
        .select("pattern_id, weekday")
        .eq("store_id", storeId)
        .order("weekday"),
      supabase
        .from("store_auto_schedule_pattern_segments")
        .select(
          "id, pattern_id, name, start_min, end_min, min_headcount, sort_order"
        )
        .eq("store_id", storeId)
        .order("sort_order"),
      supabase
        .from("store_auto_schedule_segment_roles")
        .select("segment_id, job_role_id")
        .eq("store_id", storeId),
    ]);

  const firstError =
    patternsResult.error ||
    weekdaysResult.error ||
    segmentsResult.error ||
    rolesResult.error;
  if (firstError) {
    throw firstError;
  }

  const patterns = (patternsResult.data || []) as OperatingPatternRow[];
  const weekdays = (weekdaysResult.data || []) as WeekdayRow[];
  const segments = (segmentsResult.data || []) as SegmentRow[];
  const roles = (rolesResult.data || []) as SegmentRoleRow[];

  return patterns.map((pattern) => ({
    id: pattern.id,
    name: pattern.name,
    isActive: pattern.is_active,
    sortOrder: pattern.sort_order,
    weekdays: weekdays
      .filter((row) => row.pattern_id === pattern.id)
      .map((row) => row.weekday),
    segments: segments
      .filter((segment) => segment.pattern_id === pattern.id)
      .map((segment) => ({
        id: segment.id,
        name: segment.name,
        startMin: segment.start_min,
        endMin: segment.end_min,
        minHeadcount: segment.min_headcount,
        sortOrder: segment.sort_order,
        requiredRoleIds: roles
          .filter((role) => role.segment_id === segment.id)
          .map((role) => role.job_role_id),
      })),
  }));
}

export async function replaceOperatingPatterns(
  supabase: SupabaseClient,
  storeId: string,
  patterns: OperatingPatternPayload[]
): Promise<void> {
  const roleIds = [
    ...new Set(
      patterns.flatMap((pattern) =>
        pattern.segments.flatMap((segment) => segment.requiredRoleIds)
      )
    ),
  ];

  if (roleIds.length > 0) {
    const { data, error } = await supabase
      .from("store_job_roles")
      .select("id")
      .eq("store_id", storeId)
      .eq("active", true)
      .in("id", roleIds);
    if (error) {
      throw error;
    }
    if ((data || []).length !== roleIds.length) {
      throw new Error("INVALID_OPERATING_PATTERN_ROLE");
    }
  }

  const { error } = await supabase.rpc(
    "replace_store_auto_schedule_operating_patterns",
    {
      p_store_id: storeId,
      p_patterns: patterns,
    }
  );
  if (error) {
    throw error;
  }
}
