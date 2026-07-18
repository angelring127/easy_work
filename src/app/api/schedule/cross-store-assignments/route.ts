import { NextRequest, NextResponse } from "next/server";
import { createClient, createPureClient } from "@/lib/supabase/server";
import {
  canManageStore,
  getCrossStoreAssignmentsForUsers,
  getManagedStores,
} from "@/lib/server/cross-store";
import { buildCrossStoreIdentityKey } from "@/lib/schedule/cross-store-identity";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = await createPureClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "인증이 필요합니다." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get("store_id");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (!storeId || !from || !to) {
      return NextResponse.json(
        { success: false, error: "store_id, from, to가 필요합니다." },
        { status: 400 }
      );
    }

    const canManageCurrentStore = await canManageStore(adminClient, user.id, storeId);
    if (!canManageCurrentStore) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    const managedStores = await getManagedStores(adminClient, user.id);
    const { data: currentStoreUsers, error: currentStoreUsersError } =
      await adminClient
        .from("store_users")
        .select("user_id, name, is_guest")
        .eq("store_id", storeId)
        .eq("is_active", true);

    if (currentStoreUsersError) {
      return NextResponse.json(
        { success: false, error: "현재 지점 사용자 조회에 실패했습니다." },
        { status: 500 }
      );
    }

    const identityKeys = Array.from(
      new Set(
        (currentStoreUsers || [])
          .map((row: any) =>
            buildCrossStoreIdentityKey({
              authUserId: row.user_id,
              isGuest: row.is_guest,
              name: row.name,
            })
          )
          .filter(Boolean)
      )
    );

    const data = await getCrossStoreAssignmentsForUsers(adminClient, {
      currentStoreId: storeId,
      managedStores,
      identityKeys,
      from,
      to,
    });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Cross-store assignments API error:", error);
    return NextResponse.json(
      { success: false, error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
