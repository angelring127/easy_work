import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { BusinessHourSchema } from "@/lib/validations/schedule/business-hours";

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
    .from("store_business_hours")
    .select("*")
    .eq("store_id", storeId)
    .order("weekday", { ascending: true });

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

// Bulk upsert
export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();
  if (!Array.isArray(body))
    return NextResponse.json(
      { success: false, error: "array required" },
      { status: 400 }
    );

  const { data: user, error: authError } = await supabase.auth.getUser();
  if (authError || !user.user)
    return NextResponse.json(
      { success: false, error: "unauthorized" },
      { status: 401 }
    );

  // Validate all
  for (const item of body) {
    const parsed = BusinessHourSchema.safeParse(item);
    if (!parsed.success) {
      console.error("영업시간 데이터 검증 실패:", {
        item,
        errors: parsed.error.flatten(),
      });
      return NextResponse.json(
        {
          success: false,
          error: "데이터 검증 실패",
          details: parsed.error.flatten(),
          receivedData: item,
        },
        { status: 400 }
      );
    }
  }

  const rows = body.map((p: any) => ({
    store_id: p.storeId,
    weekday: p.weekday,
    open_min: p.openMin,
    close_min: p.closeMin,
  }));

  console.log("영업시간 저장 요청 데이터:", rows);

  const { data, error } = await supabase
    .from("store_business_hours")
    .upsert(rows, { onConflict: "store_id,weekday" })
    .select();

  if (error) {
    console.error("Supabase 영업시간 저장 오류:", error);
    return NextResponse.json(
      {
        success: false,
        error: "데이터베이스 저장 실패",
        details: error.message,
        code: error.code,
        hint: error.hint,
      },
      { status: 400 }
    );
  }

  console.log("영업시간 저장 성공:", data);
  return NextResponse.json({ success: true, data });
}
