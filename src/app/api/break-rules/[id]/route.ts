import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const PatchSchema = z
  .object({
    thresholdHours: z.number().min(0).max(24).optional(),
    breakMin: z.number().int().min(0).max(240).optional(),
    paid: z.boolean().optional(),
  })
  .refine(
    (v) =>
      v.thresholdHours === undefined ||
      (typeof v.thresholdHours === "number" && v.thresholdHours >= 0),
    {
      path: ["thresholdHours"],
      message: "invalid",
    }
  );

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
  const update: Record<string, unknown> = {};
  if (p.thresholdHours !== undefined) update.threshold_hours = p.thresholdHours;
  if (p.breakMin !== undefined) update.break_min = p.breakMin;
  if (p.paid !== undefined) update.paid = p.paid;

  const { data, error } = await supabase
    .from("break_rules")
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

  const { error } = await supabase.from("break_rules").delete().eq("id", id);
  if (error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  return NextResponse.json({ success: true });
}
