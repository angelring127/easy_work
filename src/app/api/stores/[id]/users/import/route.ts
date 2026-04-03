import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { createPureClient } from "@/lib/supabase/server";
import { canManageStore } from "@/lib/server/cross-store";
import { z } from "zod";

const importUsersSchema = z.object({
  sourceStoreId: z.string().uuid(),
  candidates: z
    .array(
      z.object({
        userId: z.string().uuid().nullable().optional(),
        sourceStoreUserId: z.string().uuid().nullable().optional(),
        isGuest: z.boolean(),
      })
    )
    .min(1),
  role: z.enum(["PART_TIMER", "SUB_MANAGER"]),
});

async function importUsers(
  request: NextRequest,
  context: { user: any; params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { user, params } = context;
    const { id: targetStoreId } = await params;
    const body = await request.json();
    const parsed = importUsersSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "입력 데이터가 유효하지 않습니다" },
        { status: 400 }
      );
    }

    const { sourceStoreId, candidates, role } = parsed.data;
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

    const sourceUserIds = Array.from(
      new Set(
        candidates
          .filter((candidate) => !candidate.isGuest && candidate.userId)
          .map((candidate) => candidate.userId as string)
      )
    );
    const [
      { data: sourceRoles },
      { data: sourceStoreUsers },
      { data: targetRoles },
      { data: targetStoreUsers },
    ] = await Promise.all([
      sourceUserIds.length > 0
        ? adminClient
            .from("user_store_roles")
            .select("user_id, role, status, deleted_at")
            .eq("store_id", sourceStoreId)
            .eq("status", "ACTIVE")
            .is("deleted_at", null)
            .in("user_id", sourceUserIds)
        : Promise.resolve({ data: [] as any[] }),
      adminClient
        .from("store_users")
        .select("id, user_id, is_guest, is_active, name, role")
        .eq("store_id", sourceStoreId)
        .eq("is_active", true),
      sourceUserIds.length > 0
        ? adminClient
            .from("user_store_roles")
            .select("id, user_id, deleted_at, status")
            .eq("store_id", targetStoreId)
            .in("user_id", sourceUserIds)
        : Promise.resolve({ data: [] as any[] }),
      adminClient
        .from("store_users")
        .select("id, user_id, is_active, is_guest, name")
        .eq("store_id", targetStoreId)
        .eq("is_active", true),
    ]);

    const sourceRoleUserSet = new Set(
      (sourceRoles || []).map((row: any) => row.user_id)
    );
    const sourceStoreUserSet = new Set(
      (sourceStoreUsers || [])
        .map((row: any) => row.user_id)
        .filter(Boolean)
    );
    const sourceGuestStoreUserById = new Map(
      (sourceStoreUsers || [])
        .filter((row: any) => row.is_guest)
        .map((row: any) => [row.id, row] as const)
    );
    const targetRoleByUserId = new Map(
      (targetRoles || []).map((row: any) => [row.user_id, row] as const)
    );
    const targetStoreUserSet = new Set(
      (targetStoreUsers || [])
        .map((row: any) => row.user_id)
        .filter(Boolean)
    );
    const targetGuestNameSet = new Set(
      (targetStoreUsers || [])
        .filter((row: any) => row.is_guest)
        .map((row: any) => (row.name || "").trim())
        .filter(Boolean)
    );

    const imported: Array<{ userId: string; storeUserId?: string }> = [];
    const skipped: Array<{ userId: string; reason: string }> = [];
    const alreadyExists: Array<{ userId: string }> = [];

    for (const candidate of candidates) {
      if (candidate.isGuest) {
        const sourceStoreUserId = candidate.sourceStoreUserId;
        const guestSourceUser = sourceStoreUserId
          ? sourceGuestStoreUserById.get(sourceStoreUserId)
          : null;

        if (!guestSourceUser) {
          skipped.push({
            userId: sourceStoreUserId || "guest",
            reason: "source_store_guest_not_found",
          });
          continue;
        }

        const guestName = (guestSourceUser.name || "").trim();
        if (guestName && targetGuestNameSet.has(guestName)) {
          alreadyExists.push({ userId: sourceStoreUserId || guestName });
          continue;
        }

        const { data: createdGuestUser, error: guestInsertError } = await adminClient
          .from("store_users")
          .insert({
            store_id: targetStoreId,
            user_id: null,
            name: guestSourceUser.name,
            role,
            is_guest: true,
            is_active: true,
            granted_by: user.id,
            granted_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (guestInsertError || !createdGuestUser) {
          skipped.push({
            userId: sourceStoreUserId || "guest",
            reason: "create_guest_failed",
          });
          continue;
        }

        if (guestName) {
          targetGuestNameSet.add(guestName);
        }

        imported.push({
          userId: sourceStoreUserId || createdGuestUser.id,
          storeUserId: createdGuestUser.id,
        });

        try {
          await adminClient.from("store_audit_logs").insert({
            store_id: targetStoreId,
            user_id: user.id,
            action: "IMPORT_GUEST_USER_FROM_STORE",
            table_name: "store_users",
            old_values: {},
            new_values: {
              imported_guest_store_user_id: createdGuestUser.id,
              source_store_id: sourceStoreId,
              source_store_user_id: sourceStoreUserId,
              source_guest_name: guestSourceUser.name,
              role,
            },
          });
        } catch (auditError) {
          console.error("Guest import audit log failed:", auditError);
        }

        continue;
      }

      const userId = candidate.userId;
      if (!userId) {
        skipped.push({
          userId: "unknown",
          reason: "user_id_required",
        });
        continue;
      }

      if (
        !sourceStoreUserSet.has(userId) &&
        !sourceRoleUserSet.has(userId)
      ) {
        skipped.push({
          userId,
          reason: "source_store_member_not_found",
        });
        continue;
      }

      const existingTargetRole = targetRoleByUserId.get(userId) as any;
      if (
        (existingTargetRole &&
          existingTargetRole.status === "ACTIVE" &&
          !existingTargetRole.deleted_at) ||
        targetStoreUserSet.has(userId)
      ) {
        alreadyExists.push({ userId });
        continue;
      }

      const upsertPayload: Record<string, unknown> = {
        user_id: userId,
        store_id: targetStoreId,
        role,
        status: "ACTIVE",
        is_default_store: false,
        granted_at: new Date().toISOString(),
        deleted_at: null,
      };

      const { data: upsertedRole, error: upsertError } = await adminClient
        .from("user_store_roles")
        .upsert(upsertPayload as any, {
          onConflict: "user_id,store_id",
        })
        .select("id")
        .single();

      if (upsertError) {
        skipped.push({
          userId,
          reason: "grant_role_failed",
        });
        continue;
      }

      const { data: createdStoreUser } = await adminClient
        .from("store_users")
        .select("id")
        .eq("store_id", targetStoreId)
        .eq("user_id", userId)
        .eq("is_guest", false)
        .eq("is_active", true)
        .maybeSingle();

      imported.push({
        userId,
        storeUserId: createdStoreUser?.id,
      });

      try {
        await adminClient.from("store_audit_logs").insert({
          store_id: targetStoreId,
          user_id: user.id,
          action: "IMPORT_USER_FROM_STORE",
          table_name: "user_store_roles",
          old_values: {},
          new_values: {
            role_id: upsertedRole?.id,
            imported_user_id: userId,
            source_store_id: sourceStoreId,
            role,
          },
        });
      } catch (auditError) {
        console.error("Import audit log failed:", auditError);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        imported,
        skipped,
        alreadyExists,
      },
    });
  } catch (error) {
    console.error("Import users API error:", error);
    return NextResponse.json(
      { success: false, error: "서버 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async (req, context) => {
    return importUsers(req, { ...context, params });
  })(request);
}
