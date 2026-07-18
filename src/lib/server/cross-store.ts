import "server-only";
import {
  buildCrossStoreIdentityKey,
  GUEST_IDENTITY_PREFIX,
} from "@/lib/schedule/cross-store-identity";

export interface ManagedStoreAccess {
  id: string;
  name: string;
}

export interface CrossStoreAssignmentItem {
  authUserId: string;
  date: string;
  startTime: string;
  endTime: string;
  storeId: string;
  storeName: string;
  shortCode: string;
  assignmentId: string;
}

interface CrossStoreStoreUserRow {
  id: string;
  user_id: string | null;
  store_id: string;
  name?: string | null;
  is_active: boolean;
  is_guest: boolean;
}

interface CrossStoreScheduleAssignmentRow {
  id: string;
  store_id: string;
  user_id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
}

const MANAGER_ROLES = ["MASTER", "SUB_MANAGER", "SUB"];

const parseTimeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

const normalizeRange = (startTime: string, endTime: string) => {
  const startMin = parseTimeToMinutes(startTime);
  let endMin = parseTimeToMinutes(endTime);

  if (endMin <= startMin) {
    endMin += 24 * 60;
  }

  return { startMin, endMin };
};

export function rangesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  const rangeA = normalizeRange(startA, endA);
  const rangeB = normalizeRange(startB, endB);

  return (
    rangeA.startMin < rangeB.endMin && rangeB.startMin < rangeA.endMin
  );
}

export function buildStoreShortCodeMap(
  stores: Array<{ id: string; name: string }>
): Map<string, string> {
  const normalized = stores
    .filter((store) => store.name.trim().length > 0)
    .map((store) => ({
      id: store.id,
      name: store.name.trim(),
    }));

  const sorted = [...normalized].sort((a, b) => a.name.localeCompare(b.name));
  const codeMap = new Map<string, string>();

  sorted.forEach((store) => {
    const candidateName = store.name.replace(/\s+/g, "");
    let code = candidateName.slice(0, 1) || store.name.slice(0, 1) || "?";

    for (let length = 1; length <= candidateName.length; length += 1) {
      const nextCode = candidateName.slice(0, length);
      const hasConflict = Array.from(codeMap.values()).includes(nextCode);

      if (!hasConflict) {
        code = nextCode;
        break;
      }

      code = nextCode;
    }

    codeMap.set(store.id, code);
  });

  return codeMap;
}

export async function getManagedStores(
  adminClient: any,
  userId: string
): Promise<ManagedStoreAccess[]> {
  const [ownedStoresResult, roleStoresResult] = await Promise.all([
    adminClient
      .from("stores")
      .select("id, name")
      .eq("status", "ACTIVE")
      .eq("owner_id", userId),
    adminClient
      .from("user_store_roles")
      .select("store_id, role")
      .eq("user_id", userId)
      .eq("status", "ACTIVE")
      .in("role", MANAGER_ROLES)
      .is("deleted_at", null),
  ]);

  const storeIds = new Set<string>();
  const names = new Map<string, string>();

  for (const store of ownedStoresResult.data || []) {
    storeIds.add(store.id);
    names.set(store.id, store.name || "");
  }

  const roleStoreIds = Array.from(
    new Set((roleStoresResult.data || []).map((row: any) => row.store_id))
  );

  if (roleStoreIds.length > 0) {
    const { data: roleStores } = await adminClient
      .from("stores")
      .select("id, name")
      .eq("status", "ACTIVE")
      .in("id", roleStoreIds);

    for (const store of roleStores || []) {
      storeIds.add(store.id);
      names.set(store.id, store.name || "");
    }
  }

  return Array.from(storeIds)
    .map((id) => ({
      id,
      name: names.get(id) || "",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function canManageStore(
  adminClient: any,
  userId: string,
  storeId: string
): Promise<boolean> {
  const { data: ownedStore } = await adminClient
    .from("stores")
    .select("id")
    .eq("id", storeId)
    .eq("status", "ACTIVE")
    .eq("owner_id", userId)
    .maybeSingle();

  if (ownedStore) {
    return true;
  }

  const { data: roleStore } = await adminClient
    .from("user_store_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("store_id", storeId)
    .eq("status", "ACTIVE")
    .in("role", MANAGER_ROLES)
    .is("deleted_at", null)
    .maybeSingle();

  return Boolean(roleStore);
}

export async function getCrossStoreAssignmentsForUsers(
  adminClient: any,
  {
    currentStoreId,
    managedStores,
    identityKeys,
    from,
    to,
  }: {
    currentStoreId: string;
    managedStores: ManagedStoreAccess[];
    identityKeys: string[];
    from: string;
    to: string;
  }
): Promise<CrossStoreAssignmentItem[]> {
  const uniqueIdentityKeys = Array.from(new Set(identityKeys.filter(Boolean)));
  const candidateStores = managedStores.filter(
    (store) => store.id !== currentStoreId
  );

  if (candidateStores.length === 0 || uniqueIdentityKeys.length === 0) {
    return [];
  }

  const candidateStoreIds = candidateStores.map((store) => store.id);
  const shortCodeMap = buildStoreShortCodeMap(candidateStores);
  const identityKeySet = new Set(uniqueIdentityKeys);

  const { data: storeUsers, error: storeUsersError } = await adminClient
    .from("store_users")
    .select("id, user_id, store_id, name, is_active, is_guest")
    .in("store_id", candidateStoreIds)
    .eq("is_active", true);

  if (storeUsersError || !storeUsers || storeUsers.length === 0) {
    return [];
  }

  const typedStoreUsers = (storeUsers as CrossStoreStoreUserRow[]).filter((row) => {
    const identityKey = buildCrossStoreIdentityKey({
      authUserId: row.user_id,
      isGuest: row.is_guest,
      name: row.name,
    });
    return identityKey ? identityKeySet.has(identityKey) : false;
  });

  if (typedStoreUsers.length === 0) {
    return [];
  }

  const storeUserIds = typedStoreUsers.map((row) => row.id);
  const storeUserById = new Map<string, CrossStoreStoreUserRow>(
    typedStoreUsers.map((row) => [row.id, row] as const)
  );
  const storeNameMap = new Map(
    candidateStores.map((store) => [store.id, store.name] as const)
  );

  const { data: assignments, error: assignmentsError } = await adminClient
    .from("schedule_assignments")
    .select("id, store_id, user_id, date, start_time, end_time, status")
    .in("store_id", candidateStoreIds)
    .in("user_id", storeUserIds)
    .gte("date", from)
    .lte("date", to)
    .in("status", ["ASSIGNED", "CONFIRMED"])
    .order("date", { ascending: true })
    .order("start_time", { ascending: true });

  if (assignmentsError || !assignments) {
    return [];
  }

  return (assignments as CrossStoreScheduleAssignmentRow[])
    .map((assignment) => {
      const storeUser = storeUserById.get(assignment.user_id);
      const identityKey = buildCrossStoreIdentityKey({
        authUserId: storeUser?.user_id,
        isGuest: storeUser?.is_guest,
        name: storeUser?.name,
      });

      if (!identityKey) {
        return null;
      }

      return {
        assignmentId: assignment.id,
        authUserId: identityKey,
        date: assignment.date,
        startTime: assignment.start_time,
        endTime: assignment.end_time,
        storeId: assignment.store_id,
        storeName: storeNameMap.get(assignment.store_id) || "",
        shortCode: shortCodeMap.get(assignment.store_id) || "?",
      } satisfies CrossStoreAssignmentItem;
    })
    .filter((assignment): assignment is CrossStoreAssignmentItem =>
      Boolean(assignment)
    );
}

export async function getCrossStoreConflicts(
  adminClient: any,
  {
    currentStoreId,
    managedStores,
    identityKey,
    date,
    startTime,
    endTime,
  }: {
    currentStoreId: string;
    managedStores: ManagedStoreAccess[];
    identityKey: string | null | undefined;
    date: string;
    startTime: string;
    endTime: string;
  }
): Promise<CrossStoreAssignmentItem[]> {
  if (!identityKey) {
    return [];
  }

  const assignments = await getCrossStoreAssignmentsForUsers(adminClient, {
    currentStoreId,
    managedStores,
    identityKeys: [identityKey],
    from: date,
    to: date,
  });

  return assignments.filter((assignment) =>
    rangesOverlap(startTime, endTime, assignment.startTime, assignment.endTime)
  );
}
