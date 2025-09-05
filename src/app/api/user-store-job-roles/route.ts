import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { UserStoreJobRolesSchema } from "@/lib/validations/schedule/job-roles";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const storeId = searchParams.get("store_id");
  const userId = searchParams.get("user_id");

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

  let query = supabase
    .from("user_store_job_roles")
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
    .eq("store_id", storeId);

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

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

  const parsed = UserStoreJobRolesSchema.safeParse(body);
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

  // 관리자 권한 확인
  const { data: userRole, error: roleError } = await supabase
    .from("user_store_roles")
    .select("role")
    .eq("store_id", payload.storeId)
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

  // 기존 역할 삭제
  const { error: deleteError } = await supabase
    .from("user_store_job_roles")
    .delete()
    .eq("store_id", payload.storeId)
    .eq("user_id", payload.userId);

  if (deleteError) {
    return NextResponse.json(
      { success: false, error: deleteError.message },
      { status: 400 }
    );
  }

  // 새 역할 추가
  const roleData = payload.jobRoleIds.map((jobRoleId) => ({
    store_id: payload.storeId,
    user_id: payload.userId,
    job_role_id: jobRoleId,
  }));

  const { data, error } = await supabase
    .from("user_store_job_roles")
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

  const parsed = UserStoreJobRolesSchema.safeParse(body);
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

  // 관리자 권한 확인
  const { data: userRole, error: roleError } = await supabase
    .from("user_store_roles")
    .select("role")
    .eq("store_id", payload.storeId)
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
    .from("user_store_job_roles")
    .delete()
    .eq("store_id", payload.storeId)
    .eq("user_id", payload.userId)
    .in("job_role_id", payload.jobRoleIds);

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true });
}
