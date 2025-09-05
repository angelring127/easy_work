import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { WorkItemRequiredRolesSchema } from "@/lib/validations/schedule/job-roles";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const workItemId = searchParams.get("work_item_id");

  if (!workItemId) {
    return NextResponse.json(
      { success: false, error: "work_item_id required" },
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
    .from("work_item_required_roles")
    .select(
      `
      *,
      store_job_roles (
        id,
        name,
        code,
        description,
        active
      )
    `
    )
    .eq("work_item_id", workItemId)
    .order("min_count", { ascending: false });

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  }

  return NextResponse.json(
    { success: true, data },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();

  const parsed = WorkItemRequiredRolesSchema.safeParse(body);
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

  // 근무 항목의 매장 ID 확인
  const { data: workItem, error: workItemError } = await supabase
    .from("work_items")
    .select("store_id")
    .eq("id", payload.workItemId)
    .single();

  if (workItemError || !workItem) {
    return NextResponse.json(
      { success: false, error: "근무 항목을 찾을 수 없습니다" },
      { status: 404 }
    );
  }

  // 관리자 권한 확인
  const { data: userRole, error: roleError } = await supabase
    .from("user_store_roles")
    .select("role")
    .eq("store_id", workItem.store_id)
    .eq("user_id", user.user.id)
    .eq("status", "ACTIVE")
    .single();

  if (
    roleError ||
    !userRole ||
    !["MASTER", "SUB_MANAGER"].includes(userRole.role)
  ) {
    return NextResponse.json(
      { success: false, error: "관리자 권한이 필요합니다" },
      { status: 403 }
    );
  }

  // 기존 역할 요구 삭제
  const { error: deleteError } = await supabase
    .from("work_item_required_roles")
    .delete()
    .eq("work_item_id", payload.workItemId);

  if (deleteError) {
    return NextResponse.json(
      { success: false, error: deleteError.message },
      { status: 400 }
    );
  }

  // 새 역할 요구 추가
  const roleData = payload.roles.map((role) => ({
    work_item_id: payload.workItemId,
    job_role_id: role.jobRoleId,
    min_count: role.minCount,
  }));

  const { data, error } = await supabase
    .from("work_item_required_roles")
    .insert(roleData).select(`
      *,
      store_job_roles (
        id,
        name,
        code,
        description,
        active
      )
    `);

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true, data }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();

  const { workItemId } = body;

  if (!workItemId) {
    return NextResponse.json(
      { success: false, error: "work_item_id required" },
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

  // 근무 항목의 매장 ID 확인
  const { data: workItem, error: workItemError } = await supabase
    .from("work_items")
    .select("store_id")
    .eq("id", workItemId)
    .single();

  if (workItemError || !workItem) {
    return NextResponse.json(
      { success: false, error: "근무 항목을 찾을 수 없습니다" },
      { status: 404 }
    );
  }

  // 관리자 권한 확인
  const { data: userRole, error: roleError } = await supabase
    .from("user_store_roles")
    .select("role")
    .eq("store_id", workItem.store_id)
    .eq("user_id", user.user.id)
    .eq("status", "ACTIVE")
    .single();

  if (
    roleError ||
    !userRole ||
    !["MASTER", "SUB_MANAGER"].includes(userRole.role)
  ) {
    return NextResponse.json(
      { success: false, error: "관리자 권한이 필요합니다" },
      { status: 403 }
    );
  }

  const { error } = await supabase
    .from("work_item_required_roles")
    .delete()
    .eq("work_item_id", workItemId);

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true });
}
