import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const PatchSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  startMin: z.number().int().min(0).max(1440).optional(),
  endMin: z.number().int().min(0).max(1440).optional(),
  unpaidBreakMin: z.number().int().min(0).optional(),
  maxHeadcount: z.number().int().min(1).max(99).optional(),
  roleHint: z.string().max(32).optional(),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const resolved = await context.params;
  const id = resolved.id;
  const body = await request.json();

  // Partial update schema
  const parsed = PatchSchema.safeParse(body);
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

  // 근무항목이 존재하는지 확인하고 매장 권한 검증
  const { data: workItem, error: workItemError } = await supabase
    .from("work_items")
    .select("id, store_id")
    .eq("id", id)
    .single();

  if (workItemError || !workItem) {
    return NextResponse.json(
      { success: false, error: "Work item not found" },
      { status: 404 }
    );
  }

  // 매장 관리 권한 확인
  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("id, owner_id")
    .eq("id", workItem.store_id)
    .single();

  if (storeError || !store) {
    return NextResponse.json(
      { success: false, error: "Store not found" },
      { status: 404 }
    );
  }

  // 소유자 또는 관리자 권한 확인
  const isOwner = store.owner_id === user.user.id;
  const { data: userRole } = await supabase
    .from("user_store_roles")
    .select("role")
    .eq("store_id", workItem.store_id)
    .eq("user_id", user.user.id)
    .eq("status", "ACTIVE")
    .single();

  const isManager =
    userRole && ["MASTER", "SUB_MANAGER"].includes(userRole.role);

  if (!isOwner && !isManager) {
    return NextResponse.json(
      { success: false, error: "Insufficient permissions" },
      { status: 403 }
    );
  }

  const p = parsed.data as z.infer<typeof PatchSchema>;

  // optional: validate relational invariants if both provided
  if (
    p.startMin !== undefined &&
    p.endMin !== undefined &&
    p.endMin <= p.startMin
  ) {
    return NextResponse.json(
      { success: false, error: "End must be greater than Start" },
      { status: 400 }
    );
  }
  if (
    p.unpaidBreakMin !== undefined &&
    p.startMin !== undefined &&
    p.endMin !== undefined &&
    p.unpaidBreakMin > p.endMin - p.startMin
  ) {
    return NextResponse.json(
      { success: false, error: "Break too long" },
      { status: 400 }
    );
  }

  const update: Record<string, unknown> = {};
  if (p.name !== undefined) update.name = p.name;
  if (p.startMin !== undefined) update.start_min = p.startMin;
  if (p.endMin !== undefined) update.end_min = p.endMin;
  if (p.unpaidBreakMin !== undefined)
    update.unpaid_break_min = p.unpaidBreakMin;
  if (p.maxHeadcount !== undefined) update.max_headcount = p.maxHeadcount;
  if (p.roleHint !== undefined) update.role_hint = p.roleHint ?? null;

  const { data, error } = await supabase
    .from("work_items")
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
  if (authError || !user.user) {
    return NextResponse.json(
      { success: false, error: "unauthorized" },
      { status: 401 }
    );
  }

  // 근무항목이 존재하는지 확인하고 매장 권한 검증
  const { data: workItem, error: workItemError } = await supabase
    .from("work_items")
    .select("id, store_id")
    .eq("id", id)
    .single();

  if (workItemError || !workItem) {
    return NextResponse.json(
      { success: false, error: "Work item not found" },
      { status: 404 }
    );
  }

  // 매장 관리 권한 확인
  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("id, owner_id")
    .eq("id", workItem.store_id)
    .single();

  if (storeError || !store) {
    return NextResponse.json(
      { success: false, error: "Store not found" },
      { status: 404 }
    );
  }

  // 소유자 또는 관리자 권한 확인
  const isOwner = store.owner_id === user.user.id;
  const { data: userRole } = await supabase
    .from("user_store_roles")
    .select("role")
    .eq("store_id", workItem.store_id)
    .eq("user_id", user.user.id)
    .eq("status", "ACTIVE")
    .single();

  const isManager =
    userRole && ["MASTER", "SUB_MANAGER"].includes(userRole.role);

  if (!isOwner && !isManager) {
    return NextResponse.json(
      { success: false, error: "Insufficient permissions" },
      { status: 403 }
    );
  }

  const { error } = await supabase.from("work_items").delete().eq("id", id);
  if (error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  return NextResponse.json({ success: true });
}
