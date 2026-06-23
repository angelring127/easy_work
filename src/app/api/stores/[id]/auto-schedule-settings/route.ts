import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/auth/middleware";
import { createClient, createPureClient } from "@/lib/supabase/server";

const conditionKeys = [
  "desired_weekly_hours",
  "day_off_preference",
  "preferred_weekday",
] as const;

const defaultConditionPriorities = [
  { conditionKey: "desired_weekly_hours", priorityRank: 1, weight: 30 },
  { conditionKey: "day_off_preference", priorityRank: 2, weight: 20 },
  { conditionKey: "preferred_weekday", priorityRank: 3, weight: 10 },
] as const;

const conditionPrioritySchema = z.object({
  conditionKey: z.enum(conditionKeys),
  priorityRank: z.number().int().min(1).max(3),
  weight: z.number().int().min(0).max(100),
});

const userPrioritySchema = z.object({
  userId: z.string().uuid(),
  priorityRank: z.number().int().min(1),
});

const openingPolicySchema = z.object({
  enabled: z.boolean(),
  startSource: z.enum(["business_open", "custom"]),
  customStartMin: z.number().int().min(0).max(1440).nullable(),
  endMin: z.number().int().min(0).max(1440).nullable(),
  requiredHeadcount: z.number().int().min(1).max(99),
  failureMode: z.enum(["warn_and_continue", "block_commit"]),
  openingWorkItemIds: z.array(z.string().uuid()),
});

const updateSettingsSchema = z.object({
  conditionPriorities: z.array(conditionPrioritySchema).optional(),
  userPriorities: z.array(userPrioritySchema).optional(),
  openingPolicy: openingPolicySchema.optional(),
});

type StoreUserRow = {
  id: string;
  user_id: string | null;
  name: string | null;
  role: string;
  is_active: boolean;
  is_guest: boolean | null;
  granted_at: string;
};

async function canManageAutoScheduleSettings(storeId: string, userId: string) {
  const supabase = await createClient();

  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("id, owner_id")
    .eq("id", storeId)
    .eq("status", "ACTIVE")
    .single();

  if (storeError || !store) {
    return { allowed: false, status: 404, error: "Store not found" };
  }

  if (store.owner_id === userId) {
    return { allowed: true, status: 200, error: null };
  }

  const { data: role } = await supabase
    .from("user_store_roles")
    .select("role")
    .eq("store_id", storeId)
    .eq("user_id", userId)
    .eq("status", "ACTIVE")
    .single();

  if (role && ["MASTER", "SUB_MANAGER"].includes(role.role)) {
    return { allowed: true, status: 200, error: null };
  }

  return { allowed: false, status: 403, error: "Insufficient permissions" };
}

function validateUniqueRanks<T extends { priorityRank?: number }>(rows: T[]) {
  const ranks = new Set<number>();
  rows.forEach((row) => {
    if (typeof row.priorityRank === "number") {
      ranks.add(row.priorityRank);
    }
  });
  return ranks.size === rows.length;
}

function normalizeConditionPriorities(
  rows:
    | Array<{
        condition_key: string;
        priority_rank: number;
        weight: number;
      }>
    | null
    | undefined
) {
  if (!rows || rows.length === 0) {
    return [...defaultConditionPriorities];
  }

  const byKey = new Map(
    rows.map((row) => [
      row.condition_key,
      {
        conditionKey: row.condition_key,
        priorityRank: row.priority_rank,
        weight: row.weight,
      },
    ])
  );

  return defaultConditionPriorities
    .map((fallback) => byKey.get(fallback.conditionKey) || fallback)
    .sort((a, b) => a.priorityRank - b.priorityRank);
}

async function getAuthUserNames(userIds: string[]) {
  if (userIds.length === 0) {
    return new Map<string, string>();
  }

  try {
    const adminClient = await createPureClient();
    const { data, error } = await adminClient.auth.admin.listUsers();
    if (error) {
      return new Map<string, string>();
    }

    return new Map(
      data.users
        .filter((user) => userIds.includes(user.id))
        .map((user) => [
          user.id,
          user.user_metadata?.invited_name ||
            user.user_metadata?.name ||
            user.email ||
            user.id,
        ])
    );
  } catch {
    return new Map<string, string>();
  }
}

async function getSettings(
  request: NextRequest,
  context: { user: any; params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const storeId = params.id;
  const permission = await canManageAutoScheduleSettings(
    storeId,
    context.user.id
  );

  if (!permission.allowed) {
    return NextResponse.json(
      { success: false, error: permission.error },
      { status: permission.status }
    );
  }

  const supabase = await createClient();

  const [
    conditionResult,
    userPriorityResult,
    openingPolicyResult,
    openingWorkItemsResult,
    workItemsResult,
    storeUsersResult,
  ] = await Promise.all([
    supabase
      .from("store_auto_schedule_condition_priorities")
      .select("condition_key, priority_rank, weight")
      .eq("store_id", storeId)
      .order("priority_rank"),
    supabase
      .from("store_auto_schedule_user_priorities")
      .select("user_id, priority_rank")
      .eq("store_id", storeId)
      .order("priority_rank"),
    supabase
      .from("store_auto_schedule_opening_policies")
      .select("*")
      .eq("store_id", storeId)
      .maybeSingle(),
    supabase
      .from("store_auto_schedule_opening_work_items")
      .select("work_item_id")
      .eq("store_id", storeId),
    supabase
      .from("work_items")
      .select("id, name, start_min, end_min")
      .eq("store_id", storeId)
      .order("start_min"),
    supabase
      .from("store_users")
      .select("id, user_id, name, role, is_active, is_guest, granted_at")
      .eq("store_id", storeId)
      .order("granted_at"),
  ]);

  const firstError =
    conditionResult.error ||
    userPriorityResult.error ||
    openingPolicyResult.error ||
    openingWorkItemsResult.error ||
    workItemsResult.error ||
    storeUsersResult.error;

  if (firstError) {
    return NextResponse.json(
      { success: false, error: firstError.message },
      { status: 500 }
    );
  }

  const storeUsers = (storeUsersResult.data || []) as StoreUserRow[];
  const activeStoreUsers = storeUsers.filter((member) => member.is_active);
  const userNameMap = await getAuthUserNames(
    activeStoreUsers
      .map((member) => member.user_id)
      .filter((userId): userId is string => Boolean(userId))
  );
  const priorityByUser = new Map(
    (userPriorityResult.data || []).map((priority) => [
      priority.user_id,
      priority.priority_rank,
    ])
  );

  const userPriorities = activeStoreUsers
    .map((member, index) => ({
      userId: member.id,
      name:
        member.name ||
        (member.user_id ? userNameMap.get(member.user_id) : null) ||
        "Unknown user",
      role: member.role,
      isActive: member.is_active,
      isGuest: Boolean(member.is_guest),
      priorityRank:
        priorityByUser.get(member.id) || activeStoreUsers.length + index + 1,
    }))
    .sort((a, b) => {
      if (a.priorityRank !== b.priorityRank) {
        return a.priorityRank - b.priorityRank;
      }
      return a.name.localeCompare(b.name);
    })
    .map((member, index) => ({ ...member, priorityRank: index + 1 }));

  const openingPolicy = openingPolicyResult.data
    ? {
        enabled: openingPolicyResult.data.enabled,
        startSource: openingPolicyResult.data.start_source,
        customStartMin: openingPolicyResult.data.custom_start_min,
        endMin: openingPolicyResult.data.end_min,
        requiredHeadcount: openingPolicyResult.data.required_headcount,
        failureMode: openingPolicyResult.data.failure_mode,
        openingWorkItemIds: (openingWorkItemsResult.data || []).map(
          (row) => row.work_item_id
        ),
      }
    : {
        enabled: true,
        startSource: "business_open",
        customStartMin: null,
        endMin: 660,
        requiredHeadcount: 1,
        failureMode: "warn_and_continue",
        openingWorkItemIds: [],
      };

  return NextResponse.json({
    success: true,
    data: {
      conditionPriorities: normalizeConditionPriorities(conditionResult.data),
      userPriorities,
      openingPolicy,
      workItems: workItemsResult.data || [],
    },
  });
}

async function updateSettings(
  request: NextRequest,
  context: { user: any; params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const storeId = params.id;
  const permission = await canManageAutoScheduleSettings(
    storeId,
    context.user.id
  );

  if (!permission.allowed) {
    return NextResponse.json(
      { success: false, error: permission.error },
      { status: permission.status }
    );
  }

  const parsed = updateSettingsSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const payload = parsed.data;
  const supabase = await createClient();

  if (payload.conditionPriorities) {
    if (
      payload.conditionPriorities.length !== conditionKeys.length ||
      !validateUniqueRanks(payload.conditionPriorities)
    ) {
      return NextResponse.json(
        { success: false, error: "Invalid condition priorities" },
        { status: 400 }
      );
    }

    const { error: deleteError } = await supabase
      .from("store_auto_schedule_condition_priorities")
      .delete()
      .eq("store_id", storeId);
    if (deleteError) {
      return NextResponse.json(
        { success: false, error: deleteError.message },
        { status: 500 }
      );
    }

    const { error: insertError } = await supabase
      .from("store_auto_schedule_condition_priorities")
      .insert(
        payload.conditionPriorities.map((priority) => ({
          store_id: storeId,
          condition_key: priority.conditionKey,
          priority_rank: priority.priorityRank,
          weight: priority.weight,
        }))
      );
    if (insertError) {
      return NextResponse.json(
        { success: false, error: insertError.message },
        { status: 500 }
      );
    }
  }

  if (payload.userPriorities) {
    if (!validateUniqueRanks(payload.userPriorities)) {
      return NextResponse.json(
        { success: false, error: "Invalid user priorities" },
        { status: 400 }
      );
    }

    const userIds = payload.userPriorities.map((priority) => priority.userId);
    if (userIds.length > 0) {
      const { data: validUsers, error: validUsersError } = await supabase
        .from("store_users")
        .select("id")
        .eq("store_id", storeId)
        .eq("is_active", true)
        .in("id", userIds);

      if (validUsersError) {
        return NextResponse.json(
          { success: false, error: validUsersError.message },
          { status: 500 }
        );
      }

      if ((validUsers || []).length !== new Set(userIds).size) {
        return NextResponse.json(
          { success: false, error: "Invalid user priority member" },
          { status: 400 }
        );
      }
    }

    const { error: deleteError } = await supabase
      .from("store_auto_schedule_user_priorities")
      .delete()
      .eq("store_id", storeId);
    if (deleteError) {
      return NextResponse.json(
        { success: false, error: deleteError.message },
        { status: 500 }
      );
    }

    if (payload.userPriorities.length > 0) {
      const { error: insertError } = await supabase
        .from("store_auto_schedule_user_priorities")
        .insert(
          payload.userPriorities.map((priority) => ({
            store_id: storeId,
            user_id: priority.userId,
            priority_rank: priority.priorityRank,
          }))
        );
      if (insertError) {
        return NextResponse.json(
          { success: false, error: insertError.message },
          { status: 500 }
        );
      }
    }
  }

  if (payload.openingPolicy) {
    const openingPolicy = payload.openingPolicy;

    if (openingPolicy.openingWorkItemIds.length > 0) {
      const { data: validWorkItems, error: validWorkItemsError } =
        await supabase
          .from("work_items")
          .select("id")
          .eq("store_id", storeId)
          .in("id", openingPolicy.openingWorkItemIds);

      if (validWorkItemsError) {
        return NextResponse.json(
          { success: false, error: validWorkItemsError.message },
          { status: 500 }
        );
      }

      if (
        (validWorkItems || []).length !==
        new Set(openingPolicy.openingWorkItemIds).size
      ) {
        return NextResponse.json(
          { success: false, error: "Invalid opening work item" },
          { status: 400 }
        );
      }
    }

    const { error: policyError } = await supabase
      .from("store_auto_schedule_opening_policies")
      .upsert(
        {
          store_id: storeId,
          enabled: openingPolicy.enabled,
          start_source: openingPolicy.startSource,
          custom_start_min: openingPolicy.customStartMin,
          end_min: openingPolicy.endMin,
          required_headcount: openingPolicy.requiredHeadcount,
          failure_mode: openingPolicy.failureMode,
        },
        { onConflict: "store_id" }
      );

    if (policyError) {
      return NextResponse.json(
        { success: false, error: policyError.message },
        { status: 500 }
      );
    }

    const { error: deleteError } = await supabase
      .from("store_auto_schedule_opening_work_items")
      .delete()
      .eq("store_id", storeId);
    if (deleteError) {
      return NextResponse.json(
        { success: false, error: deleteError.message },
        { status: 500 }
      );
    }

    if (openingPolicy.openingWorkItemIds.length > 0) {
      const { error: insertError } = await supabase
        .from("store_auto_schedule_opening_work_items")
        .insert(
          openingPolicy.openingWorkItemIds.map((workItemId) => ({
            store_id: storeId,
            work_item_id: workItemId,
          }))
        );

      if (insertError) {
        return NextResponse.json(
          { success: false, error: insertError.message },
          { status: 500 }
        );
      }
    }
  }

  return NextResponse.json({ success: true });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async (req, context) =>
    getSettings(req, { ...context, params })
  )(request);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async (req, context) =>
    updateSettings(req, { ...context, params })
  )(request);
}
