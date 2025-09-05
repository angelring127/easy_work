import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { WorkItemSchema } from "@/lib/validations/schedule/work-item";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const storeId = searchParams.get("store_id");
  if (!storeId) {
    return NextResponse.json(
      { success: false, error: "store_id required" },
      { status: 400 }
    );
  }

  const { data: user, error: authError } = await supabase.auth.getUser();
  if (authError || !user.user) {
    return NextResponse.json(
      { success: false, error: "unauthorized" },
      { status: 401 }
    );
  }

  const { data, error } = await supabase
    .from("work_items")
    .select("*")
    .eq("store_id", storeId)
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

  const parsed = WorkItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { data: user, error: authError } = await supabase.auth.getUser();
  if (authError || !user.user) {
    return NextResponse.json(
      { success: false, error: "unauthorized" },
      { status: 401 }
    );
  }

  const payload = parsed.data;

  // name uniqueness per store enforced by DB unique constraint
  const { data, error } = await supabase
    .from("work_items")
    .insert({
      store_id: payload.storeId,
      name: payload.name,
      start_min: payload.startMin,
      end_min: payload.endMin,
      unpaid_break_min: payload.unpaidBreakMin,
      max_headcount: payload.maxHeadcount,
      role_hint: payload.roleHint ?? null,
    })
    .select();

  if (error) {
    const status = error.code === "23505" ? 409 : 400; // unique violation
    return NextResponse.json(
      { success: false, error: error.message },
      { status }
    );
  }

  return NextResponse.json({ success: true, data: data?.[0] }, { status: 201 });
}
