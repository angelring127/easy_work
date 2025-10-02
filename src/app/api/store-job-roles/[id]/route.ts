import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { UpdateStoreJobRoleSchema } from "@/lib/validations/schedule/job-roles";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const body = await request.json();
  const { id } = await params;

  const parsed = UpdateStoreJobRoleSchema.safeParse(body);
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

  // 기존 역할 조회하여 매장 ID 확인
  const { data: existingRole, error: fetchError } = await supabase
    .from("store_job_roles")
    .select("store_id")
    .eq("id", id)
    .single();

  if (fetchError || !existingRole) {
    return NextResponse.json(
      { success: false, error: "역할을 찾을 수 없습니다" },
      { status: 404 }
    );
  }

  // 관리자 권한 확인
  const { data: userRole, error: roleError } = await supabase
    .from("user_store_roles")
    .select("role")
    .eq("store_id", existingRole.store_id)
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

  // code 필드가 없으면 기존 code 유지, 있으면 업데이트
  const updateData: any = {};
  if (payload.name !== undefined) updateData.name = payload.name;
  if (payload.code !== undefined) updateData.code = payload.code;
  if (payload.description !== undefined)
    updateData.description = payload.description;
  if (payload.active !== undefined) updateData.active = payload.active;

  const { data, error } = await supabase
    .from("store_job_roles")
    .update(updateData)
    .eq("id", id)
    .select();

  if (error) {
    const status = error.code === "23505" ? 409 : 400; // unique violation
    return NextResponse.json(
      { success: false, error: error.message },
      { status }
    );
  }

  return NextResponse.json({ success: true, data: data?.[0] });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  const { data: user, error: authError } = await supabase.auth.getUser();
  if (authError || !user.user) {
    return NextResponse.json(
      { success: false, error: "unauthorized" },
      { status: 401 }
    );
  }

  // 기존 역할 조회하여 매장 ID 확인
  const { data: existingRole, error: fetchError } = await supabase
    .from("store_job_roles")
    .select("store_id")
    .eq("id", id)
    .single();

  if (fetchError || !existingRole) {
    return NextResponse.json(
      { success: false, error: "역할을 찾을 수 없습니다" },
      { status: 404 }
    );
  }

  // 관리자 권한 확인
  const { data: userRole, error: roleError } = await supabase
    .from("user_store_roles")
    .select("role")
    .eq("store_id", existingRole.store_id)
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

  // 역할 사용 중인지 확인
  const { data: usageCheck, error: usageError } = await supabase
    .from("user_store_job_roles")
    .select("user_id")
    .eq("job_role_id", id)
    .limit(1);

  if (usageError) {
    return NextResponse.json(
      { success: false, error: usageError.message },
      { status: 400 }
    );
  }

  if (usageCheck && usageCheck.length > 0) {
    return NextResponse.json(
      { success: false, error: "사용 중인 역할은 삭제할 수 없습니다" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("store_job_roles")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true });
}
