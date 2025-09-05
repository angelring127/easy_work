import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { StaffingTargetSchema } from "@/lib/validations/schedule/staffing-target";

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
    .from("staffing_targets")
    .select("*")
    .eq("store_id", storeId)
    .order("weekday", { ascending: true })
    .order("start_min", { ascending: true });

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

  const parsed = StaffingTargetSchema.safeParse(body);
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
    .from("staffing_targets")
    .insert({
      store_id: p.storeId,
      weekday: p.weekday,
      start_min: p.startMin,
      end_min: p.endMin,
      role_hint: p.roleHint ?? null,
      min_headcount: p.minHeadcount,
      max_headcount: p.maxHeadcount,
    })
    .select();

  if (error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  return NextResponse.json({ success: true, data: data?.[0] }, { status: 201 });
}
