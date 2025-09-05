import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { StoreJobRoleSchema } from "@/lib/validations/schedule/job-roles";

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
    .from("store_job_roles")
    .select("*")
    .eq("store_id", storeId)
    .order("name", { ascending: true });

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

  const parsed = StoreJobRoleSchema.safeParse(body);
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

  // code 필드가 없으면 name을 기반으로 자동 생성
  const autoCode =
    payload.code ||
    payload.name.toLowerCase().replace(/\s+/g, "_").substring(0, 20);

  const { data, error } = await supabase
    .from("store_job_roles")
    .insert({
      store_id: payload.storeId,
      name: payload.name,
      code: autoCode,
      description: payload.description || null,
      active: payload.active,
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
