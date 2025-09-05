import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { BreakRuleSchema } from "@/lib/validations/schedule/break-rule";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const storeId = searchParams.get("store_id");
  if (!storeId)
    return NextResponse.json(
      { success: false, error: "store_id required" },
      { status: 400 }
    );

  const { data: user, error: authError } = await supabase.auth.getUser();
  if (authError || !user.user)
    return NextResponse.json(
      { success: false, error: "unauthorized" },
      { status: 401 }
    );

  const { data, error } = await supabase
    .from("break_rules")
    .select("*")
    .eq("store_id", storeId)
    .order("threshold_hours", { ascending: true });

  if (error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  return NextResponse.json(
    { success: true, data },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();

  const parsed = BreakRuleSchema.safeParse(body);
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

  const p = parsed.data;
  const { data, error } = await supabase
    .from("break_rules")
    .insert({
      store_id: p.storeId,
      threshold_hours: p.thresholdHours,
      break_min: p.breakMin,
      paid: p.paid,
    })
    .select();

  if (error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  return NextResponse.json({ success: true, data: data?.[0] }, { status: 201 });
}
