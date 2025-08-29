import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get("storeId");
    const email = searchParams.get("email");

    if (!storeId) {
      return NextResponse.json(
        { success: false, error: "storeId is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // 1. invitations 테이블 조회
    const { data: invitations, error: invitationsError } = await supabase
      .from("invitations")
      .select("*")
      .eq("store_id", storeId)
      .eq("invited_email", email || "")
      .order("created_at", { ascending: false });

    // 2. invites 테이블 조회
    const { data: invites, error: invitesError } = await supabase
      .from("invites")
      .select("*")
      .eq("store_id", storeId)
      .eq("email", email || "")
      .order("invited_at", { ascending: false });

    // 3. 사용자 정보 조회
    const { data: users } = await supabase.auth.admin.listUsers();
    const user = users?.users?.find(
      (u) => u.email?.toLowerCase() === email?.toLowerCase()
    );

    return NextResponse.json({
      success: true,
      data: {
        invitations: invitations || [],
        invites: invites || [],
        user: user
          ? {
              id: user.id,
              email: user.email,
              metadata: user.user_metadata,
            }
          : null,
        errors: {
          invitations: invitationsError,
          invites: invitesError,
        },
      },
    });
  } catch (error) {
    console.error("초대 상태 확인 API 오류:", error);
    return NextResponse.json(
      { success: false, error: "서버 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
