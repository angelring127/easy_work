import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const PatchSchema = z.object({
  weekday: z.number().int().min(0).max(6).optional(),
  startMin: z.number().int().min(0).max(1440).optional(),
  endMin: z.number().int().min(0).max(1440).optional(),
  roleHint: z.string().max(32).optional(),
  minHeadcount: z.number().int().min(0).max(99).optional(),
  maxHeadcount: z.number().int().min(0).max(99).optional(),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const resolved = await context.params;
  const id = resolved.id;
  const body = await request.json();

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { success: false, error: parsed.error.flatten() },
      { status: 400 }
    );

  const { data: user, error: authError } = await supabase.auth.getUser();
  if (authError || !user.user)
    return NextResponse.json(
      { success: false, error: "unauthorized" },
      { status: 401 }
    );

  const p = parsed.data as z.infer<typeof PatchSchema>;
  if (
    p.startMin !== undefined &&
    p.endMin !== undefined &&
    p.endMin <= p.startMin
  ) {
    return NextResponse.json(
      { success: false, error: "end > start" },
      { status: 400 }
    );
  }
  if (
    p.minHeadcount !== undefined &&
    p.maxHeadcount !== undefined &&
    p.minHeadcount > p.maxHeadcount
  ) {
    return NextResponse.json(
      { success: false, error: "min ≤ max" },
      { status: 400 }
    );
  }

  const update: Record<string, unknown> = {};
  if (p.weekday !== undefined) update.weekday = p.weekday;
  if (p.startMin !== undefined) update.start_min = p.startMin;
  if (p.endMin !== undefined) update.end_min = p.endMin;
  if (p.roleHint !== undefined) update.role_hint = p.roleHint ?? null;
  if (p.minHeadcount !== undefined) update.min_headcount = p.minHeadcount;
  if (p.maxHeadcount !== undefined) update.max_headcount = p.maxHeadcount;

  const { data, error } = await supabase
    .from("staffing_targets")
    .update(update)
    .eq("id", id)
    .select();

  if (error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  return NextResponse.json({ success: true, data: data?.[0] });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const resolved = await context.params;
  const id = resolved.id;

  const { data: user, error: authError } = await supabase.auth.getUser();
  if (authError || !user.user)
    return NextResponse.json(
      { success: false, error: "unauthorized" },
      { status: 401 }
    );

  const { error } = await supabase
    .from("staffing_targets")
    .delete()
    .eq("id", id);
  if (error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  return NextResponse.json({ success: true });
}
