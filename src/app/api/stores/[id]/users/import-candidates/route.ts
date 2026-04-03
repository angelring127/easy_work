import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { createPureClient } from "@/lib/supabase/server";
import { canManageStore } from "@/lib/server/cross-store";

async function getImportCandidates(
  request: NextRequest,
  context: { user: any; params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { user, params } = context;
    const { id: targetStoreId } = await params;
    const { searchParams } = new URL(request.url);
    const sourceStoreId = searchParams.get("source_store_id");

    if (!sourceStoreId) {
      return NextResponse.json(
        { success: false, error: "source_store_id is required" },
        { status: 400 }
      );
    }

    const adminClient = await createPureClient();
    const [canManageTarget, canManageSource] = await Promise.all([
      canManageStore(adminClient, user.id, targetStoreId),
      canManageStore(adminClient, user.id, sourceStoreId),
    ]);

    if (!canManageTarget || !canManageSource) {
      return NextResponse.json(
        { success: false, error: "사용자 관리 권한이 없습니다" },
        { status: 403 }
      );
    }

    const { data: sourceStore, error: sourceStoreError } = await adminClient
      .from("stores")
      .select("id, name")
      .eq("id", sourceStoreId)
      .eq("status", "ACTIVE")
      .single();

    if (sourceStoreError || !sourceStore) {
      return NextResponse.json(
        { success: false, error: "소스 지점을 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    const [
      { data: sourceRoles, error: sourceRolesError },
      { data: sourceStoreUsers, error: sourceStoreUsersError },
    ] = await Promise.all([
      adminClient
        .from("user_store_roles")
        .select("user_id, role")
        .eq("store_id", sourceStoreId)
        .eq("status", "ACTIVE")
        .is("deleted_at", null),
      adminClient
        .from("store_users")
        .select("id, user_id, name, store_id, role, is_guest, is_active")
        .eq("store_id", sourceStoreId)
        .eq("is_active", true),
    ]);

    if (sourceRolesError || sourceStoreUsersError) {
      console.error("Import candidates source lookup failed:", {
        sourceRolesError,
        sourceStoreUsersError,
        sourceStoreId,
      });
      return NextResponse.json(
        { success: false, error: "소스 지점 사용자 조회에 실패했습니다" },
        { status: 500 }
      );
    }

    const sourceAuthUserIds = Array.from(
      new Set(
        [
          ...(sourceRoles || []).map((row: any) => row.user_id),
          ...(sourceStoreUsers || []).map((row: any) => row.user_id),
        ].filter(Boolean)
      )
    );
    const sourceGuestStoreUsers = (sourceStoreUsers || []).filter(
      (row: any) => row.is_guest
    );

    if (sourceAuthUserIds.length === 0 && sourceGuestStoreUsers.length === 0) {
      return NextResponse.json({
        success: true,
        data: { store: sourceStore, candidates: [] },
      });
    }

    const [{ data: targetRoles }, { data: targetStoreUsers }, usersResult] =
      await Promise.all([
        sourceAuthUserIds.length > 0
          ? adminClient
              .from("user_store_roles")
              .select("user_id")
              .eq("store_id", targetStoreId)
              .eq("status", "ACTIVE")
              .is("deleted_at", null)
              .in("user_id", sourceAuthUserIds)
          : Promise.resolve({ data: [] as any[] }),
        adminClient
          .from("store_users")
          .select("user_id, name, is_guest")
          .eq("store_id", targetStoreId)
          .eq("is_active", true),
        adminClient.auth.admin.listUsers(),
      ]);

    const targetUserIdSet = new Set<string>([
      ...(targetRoles || []).map((row: any) => row.user_id),
      ...(targetStoreUsers || [])
        .map((row: any) => row.user_id)
        .filter(Boolean),
    ]);
    const targetGuestNameSet = new Set<string>(
      (targetStoreUsers || [])
        .filter((row: any) => row.is_guest)
        .map((row: any) => (row.name || "").trim())
        .filter(Boolean)
    );
    const sourceStoreUserByAuthId = new Map(
      (sourceStoreUsers || [])
        .filter((row: any) => row.user_id)
        .map((row: any) => [row.user_id, row] as const)
    );
    const roleByUserId = new Map(
      (sourceRoles || []).map((row: any) => [row.user_id, row.role] as const)
    );
    const users = usersResult.data?.users || [];

    const generalCandidates = sourceAuthUserIds
      .filter((userId) => !targetUserIdSet.has(userId))
      .map((userId) => {
        const authUser = users.find((item) => item.id === userId);
        const storeUser = sourceStoreUserByAuthId.get(userId);

        return {
          importId: userId,
          userId,
          storeUserId: storeUser?.id || null,
          isGuest: false,
          name:
            storeUser?.name ||
            authUser?.user_metadata?.invited_name ||
            authUser?.user_metadata?.name ||
            authUser?.email ||
            "",
          email: authUser?.email || "",
          sourceRole: roleByUserId.get(userId) || storeUser?.role || null,
        };
      });

    const guestCandidates = sourceGuestStoreUsers
      .filter((row: any) => !targetGuestNameSet.has((row.name || "").trim()))
      .map((row: any) => ({
        importId: `guest:${row.id}`,
        userId: null,
        storeUserId: row.id,
        isGuest: true,
        name: row.name || "",
        email: "",
        sourceRole: row.role || null,
      }));

    const candidates = [...generalCandidates, ...guestCandidates].sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    return NextResponse.json({
      success: true,
      data: {
        store: sourceStore,
        candidates,
      },
    });
  } catch (error) {
    console.error("Import candidates API error:", error);
    return NextResponse.json(
      { success: false, error: "서버 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async (req, context) => {
    return getImportCandidates(req, { ...context, params });
  })(request);
}
