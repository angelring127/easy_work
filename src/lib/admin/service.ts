import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  format,
  parseISO,
  subDays,
} from "date-fns";
import { createPureClient } from "@/lib/supabase/server";
import {
  extractPlatformAdminRole,
  isPlatformAdminRole,
} from "@/lib/auth/platform-admin";
import { PlatformAdminRole, type UserProfile } from "@/types/auth";
import type {
  AdminKpiSummary,
  AdminTrendPoint,
  AnomalyItem,
  AdminAnomalyStatus,
  AdminAnomalySeverity,
} from "@/types/admin";

const DATE_FMT = "yyyy-MM-dd";

const FAIL_STATUSES = ["FAILED", "EXPIRED", "CANCELLED", "REVOKED"];
const ASSIGNMENT_DONE_STATUSES = ["ASSIGNED", "CONFIRMED"];

const safeParseDate = (value: string | null | undefined): Date | null => {
  if (!value) {
    return null;
  }

  try {
    const parsed = parseISO(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};

const toDay = (value: string | null | undefined): string | null => {
  const parsed = safeParseDate(value);
  if (!parsed) {
    return null;
  }

  return format(parsed, DATE_FMT);
};

const isActiveWithinDays = (
  lastSignInAt: string | null | undefined,
  days = 30
): boolean => {
  const parsed = safeParseDate(lastSignInAt);
  if (!parsed) {
    return false;
  }

  const threshold = subDays(new Date(), days);
  return parsed >= threshold;
};

export interface AdminQueryOptions {
  from: string;
  to: string;
  page?: number;
  limit?: number;
  q?: string;
  status?: string;
  severity?: string;
  eventType?: string;
  platformRole?: string;
}

export interface AdminOverviewData {
  summary: AdminKpiSummary;
  trends: AdminTrendPoint[];
  period: { from: string; to: string };
}

export interface AdminUserItem {
  id: string;
  email: string;
  name: string;
  platformRole: PlatformAdminRole | null;
  status: "ACTIVE" | "INACTIVE";
  lastSignInAt: string | null;
  createdAt: string;
  storeRoleCount: number;
  activeStoreRoles: number;
  inactiveStoreRoles: number;
}

export interface AdminStoreItem {
  id: string;
  name: string;
  status: string;
  timezone: string | null;
  ownerId: string;
  ownerEmail: string;
  createdAt: string;
  memberCount: number;
  managerCount: number;
  pendingInvitations: number;
  assignmentCount30d: number;
  riskScore: number;
  riskLevel: "HIGH" | "MEDIUM" | "LOW";
}

export interface AdminAuditLogItem {
  id: string;
  scope: "PLATFORM" | "STORE";
  action: string;
  eventType: string;
  targetType: string;
  targetId: string;
  actorId: string;
  actorEmail: string;
  actorRole: string;
  severity: string;
  createdAt: string;
  payload: Record<string, unknown>;
}

const getPreviousRange = (from: string, to: string) => {
  const fromDate = parseISO(from);
  const toDate = parseISO(to);
  const days = Math.max(differenceInCalendarDays(toDate, fromDate) + 1, 1);
  const prevTo = subDays(fromDate, 1);
  const prevFrom = subDays(prevTo, days - 1);

  return {
    from: format(prevFrom, DATE_FMT),
    to: format(prevTo, DATE_FMT),
  };
};

const paginate = <T>(items: T[], page = 1, limit = 20) => {
  const safePage = Math.max(page, 1);
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const start = (safePage - 1) * safeLimit;
  const end = start + safeLimit;

  return {
    page: safePage,
    limit: safeLimit,
    total: items.length,
    totalPages: Math.max(Math.ceil(items.length / safeLimit), 1),
    items: items.slice(start, end),
  };
};

const fetchAllAuthUsers = async () => {
  const adminClient = await createPureClient();
  const allUsers: any[] = [];
  const perPage = 200;

  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw error;
    }

    const users = data?.users || [];
    allUsers.push(...users);

    if (users.length < perPage) {
      break;
    }
  }

  return allUsers;
};

const buildTrendRows = (
  from: string,
  to: string,
  allUsers: any[],
  stores: any[],
  invitations: any[],
  assignments: any[]
): AdminTrendPoint[] => {
  const rows = eachDayOfInterval({
    start: parseISO(from),
    end: parseISO(to),
  }).map((day) => ({
    date: format(day, DATE_FMT),
    users: 0,
    stores: 0,
    invitations: 0,
    assignments: 0,
  }));

  const byDate = new Map(rows.map((row) => [row.date, row]));

  allUsers.forEach((user) => {
    const key = toDay(user.created_at);
    if (key && byDate.has(key)) {
      byDate.get(key)!.users += 1;
    }
  });

  stores.forEach((store) => {
    const key = toDay(store.created_at);
    if (key && byDate.has(key)) {
      byDate.get(key)!.stores += 1;
    }
  });

  invitations.forEach((invite) => {
    const key = toDay(invite.created_at);
    if (key && byDate.has(key)) {
      byDate.get(key)!.invitations += 1;
    }
  });

  assignments.forEach((assignment) => {
    const key = assignment.date || toDay(assignment.created_at);
    if (key && byDate.has(key)) {
      byDate.get(key)!.assignments += 1;
    }
  });

  return rows;
};

export async function getAdminOverview(
  from: string,
  to: string
): Promise<AdminOverviewData> {
  const adminClient = await createPureClient();
  const allUsers = await fetchAllAuthUsers();

  const { data: stores = [] } = await adminClient
    .from("stores")
    .select("id,status,created_at");

  const { data: invitations = [] } = await adminClient
    .from("invitations")
    .select("id,status,created_at")
    .gte("created_at", `${from}T00:00:00.000Z`)
    .lte("created_at", `${to}T23:59:59.999Z`);

  const { data: assignments = [] } = await adminClient
    .from("schedule_assignments")
    .select("id,status,date,created_at")
    .gte("date", from)
    .lte("date", to);

  const totalUsers = allUsers.length;
  const activeUsers = allUsers.filter((user) =>
    isActiveWithinDays(user.last_sign_in_at)
  ).length;

  const activeStores = stores.filter((store) => store.status === "ACTIVE").length;
  const archivedStores = stores.filter(
    (store) => store.status && store.status !== "ACTIVE"
  ).length;

  const pendingInvitations = invitations.filter((invite) =>
    ["PENDING", "pending"].includes(invite.status)
  ).length;

  const totalAssignments = assignments.length;
  const doneAssignments = assignments.filter((assignment) =>
    ASSIGNMENT_DONE_STATUSES.includes(assignment.status)
  ).length;

  const coverageRate =
    totalAssignments === 0
      ? 100
      : Math.round((doneAssignments / totalAssignments) * 1000) / 10;

  const summary: AdminKpiSummary = {
    totalUsers,
    activeUsers,
    inactiveUsers: Math.max(totalUsers - activeUsers, 0),
    totalStores: stores.length,
    activeStores,
    archivedStores,
    pendingInvitations,
    assignmentCoverageRate: coverageRate,
  };

  const trends = buildTrendRows(from, to, allUsers, stores, invitations, assignments);

  return {
    summary,
    trends,
    period: { from, to },
  };
}

export async function getAdminUsers(options: AdminQueryOptions) {
  const allUsers = await fetchAllAuthUsers();
  const adminClient = await createPureClient();

  let items: AdminUserItem[] = allUsers.map((user) => {
    const platformRole = extractPlatformAdminRole(
      (user.user_metadata || {}) as Record<string, unknown>
    );

    return {
      id: user.id,
      email: user.email || "",
      name:
        user.user_metadata?.name ||
        user.user_metadata?.invited_name ||
        user.email ||
        "",
      platformRole,
      status: isActiveWithinDays(user.last_sign_in_at) ? "ACTIVE" : "INACTIVE",
      lastSignInAt: user.last_sign_in_at || null,
      createdAt: user.created_at,
      storeRoleCount: 0,
      activeStoreRoles: 0,
      inactiveStoreRoles: 0,
    };
  });

  const query = (options.q || "").trim().toLowerCase();
  if (query) {
    items = items.filter(
      (item) =>
        item.email.toLowerCase().includes(query) ||
        item.name.toLowerCase().includes(query) ||
        item.id.toLowerCase().includes(query)
    );
  }

  if (options.status === "ACTIVE" || options.status === "INACTIVE") {
    items = items.filter((item) => item.status === options.status);
  }

  if (options.platformRole && isPlatformAdminRole(options.platformRole)) {
    items = items.filter((item) => item.platformRole === options.platformRole);
  }

  items.sort(
    (a, b) =>
      (safeParseDate(b.createdAt)?.getTime() || 0) -
      (safeParseDate(a.createdAt)?.getTime() || 0)
  );

  const paged = paginate(items, options.page, options.limit);
  const userIds = paged.items.map((item) => item.id);

  if (userIds.length > 0) {
    const { data: roleRows = [] } = await adminClient
      .from("user_store_roles")
      .select("user_id,status,store_id")
      .in("user_id", userIds);

    const roleStats = new Map<
      string,
      { all: number; active: number; inactive: number; stores: Set<string> }
    >();

    roleRows.forEach((row) => {
      if (!roleStats.has(row.user_id)) {
        roleStats.set(row.user_id, {
          all: 0,
          active: 0,
          inactive: 0,
          stores: new Set<string>(),
        });
      }

      const stat = roleStats.get(row.user_id)!;
      stat.all += 1;
      if (row.status === "ACTIVE") {
        stat.active += 1;
      } else {
        stat.inactive += 1;
      }
      stat.stores.add(row.store_id);
    });

    paged.items = paged.items.map((item) => {
      const stats = roleStats.get(item.id);
      if (!stats) {
        return item;
      }

      return {
        ...item,
        storeRoleCount: stats.stores.size,
        activeStoreRoles: stats.active,
        inactiveStoreRoles: stats.inactive,
      };
    });
  }

  return {
    users: paged.items,
    pagination: {
      page: paged.page,
      limit: paged.limit,
      total: paged.total,
      totalPages: paged.totalPages,
    },
    summary: {
      totalUsers: items.length,
      activeUsers: items.filter((item) => item.status === "ACTIVE").length,
      inactiveUsers: items.filter((item) => item.status === "INACTIVE").length,
    },
  };
}

export async function getAdminStores(options: AdminQueryOptions) {
  const adminClient = await createPureClient();
  const { data: stores = [] } = await adminClient
    .from("stores")
    .select("id,name,status,owner_id,timezone,created_at,updated_at");

  const baseItems: AdminStoreItem[] = stores.map((store) => ({
    id: store.id,
    name: store.name,
    status: store.status || "ACTIVE",
    timezone: store.timezone || null,
    ownerId: store.owner_id,
    ownerEmail: "",
    createdAt: store.created_at,
    memberCount: 0,
    managerCount: 0,
    pendingInvitations: 0,
    assignmentCount30d: 0,
    riskScore: 0,
    riskLevel: "LOW",
  }));

  const query = (options.q || "").trim().toLowerCase();
  let items = query
    ? baseItems.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          item.id.toLowerCase().includes(query)
      )
    : baseItems;

  if (options.status && options.status !== "ALL") {
    items = items.filter((item) => item.status === options.status);
  }

  const storeIds = items.map((item) => item.id);
  const ownerIds = Array.from(new Set(items.map((item) => item.ownerId)));

  const ownerEmailMap = new Map<string, string>();
  await Promise.all(
    ownerIds.map(async (ownerId) => {
      const { data } = await adminClient.auth.admin.getUserById(ownerId);
      ownerEmailMap.set(ownerId, data?.user?.email || "");
    })
  );

  if (storeIds.length > 0) {
    const [roleRowsResult, invitationRowsResult, assignmentRowsResult] =
      await Promise.all([
        adminClient
          .from("user_store_roles")
          .select("store_id,user_id,role,status")
          .in("store_id", storeIds),
        adminClient
          .from("invitations")
          .select("store_id,status")
          .in("store_id", storeIds),
        adminClient
          .from("schedule_assignments")
          .select("store_id,date")
          .in("store_id", storeIds)
          .gte("date", format(subDays(new Date(), 30), DATE_FMT))
          .lte("date", format(new Date(), DATE_FMT)),
      ]);

    const roleRows = roleRowsResult.data || [];
    const invitationRows = invitationRowsResult.data || [];
    const assignmentRows = assignmentRowsResult.data || [];

    const statMap = new Map<
      string,
      {
        members: Set<string>;
        managers: number;
        pendingInvitations: number;
        assignmentCount30d: number;
      }
    >();

    storeIds.forEach((storeId) => {
      statMap.set(storeId, {
        members: new Set<string>(),
        managers: 0,
        pendingInvitations: 0,
        assignmentCount30d: 0,
      });
    });

    roleRows.forEach((row) => {
      const stat = statMap.get(row.store_id);
      if (!stat || row.status !== "ACTIVE") {
        return;
      }

      stat.members.add(row.user_id);
      if (row.role === "MASTER" || row.role === "SUB_MANAGER") {
        stat.managers += 1;
      }
    });

    invitationRows.forEach((row) => {
      const stat = statMap.get(row.store_id);
      if (!stat) {
        return;
      }

      if (["PENDING", "pending"].includes(row.status)) {
        stat.pendingInvitations += 1;
      }
    });

    assignmentRows.forEach((row) => {
      const stat = statMap.get(row.store_id);
      if (!stat) {
        return;
      }

      stat.assignmentCount30d += 1;
    });

    items = items.map((item) => {
      const stat = statMap.get(item.id);
      const managerCount = stat?.managers || 0;
      const assignmentCount30d = stat?.assignmentCount30d || 0;
      const pendingInvitations = stat?.pendingInvitations || 0;

      let riskScore = 0;
      if (managerCount === 0) {
        riskScore += 50;
      }
      if (assignmentCount30d === 0) {
        riskScore += 25;
      }
      if (pendingInvitations >= 20) {
        riskScore += 25;
      }

      const riskLevel =
        riskScore >= 60 ? "HIGH" : riskScore >= 30 ? "MEDIUM" : "LOW";

      return {
        ...item,
        ownerEmail: ownerEmailMap.get(item.ownerId) || "",
        memberCount: stat?.members.size || 0,
        managerCount,
        pendingInvitations,
        assignmentCount30d,
        riskScore,
        riskLevel,
      };
    });
  }

  items.sort(
    (a, b) =>
      (safeParseDate(b.createdAt)?.getTime() || 0) -
      (safeParseDate(a.createdAt)?.getTime() || 0)
  );

  const paged = paginate(items, options.page, options.limit);

  return {
    stores: paged.items,
    pagination: {
      page: paged.page,
      limit: paged.limit,
      total: paged.total,
      totalPages: paged.totalPages,
    },
    summary: {
      activeStores: items.filter((item) => item.status === "ACTIVE").length,
      archivedStores: items.filter((item) => item.status !== "ACTIVE").length,
      highRiskStores: items.filter((item) => item.riskLevel === "HIGH").length,
    },
  };
}

const toSeverity = (current: number, baseline: number): AdminAnomalySeverity => {
  const delta = current - baseline;
  const ratio = baseline <= 0 ? current : current / baseline;

  if (ratio >= 3 || delta >= 20) {
    return "HIGH";
  }

  if (ratio >= 2 || delta >= 10) {
    return "MEDIUM";
  }

  return "LOW";
};

const shouldTrigger = (current: number, baseline: number) => {
  if (current < 5) {
    return false;
  }

  if (baseline === 0) {
    return current >= 5;
  }

  return current >= baseline * 1.5;
};

interface AnomalyDraft {
  ruleKey: string;
  title: string;
  description: string;
  metricValue: number;
  baselineValue: number;
  severity: AdminAnomalySeverity;
}

const detectAnomalies = async (
  from: string,
  to: string
): Promise<AnomalyDraft[]> => {
  const adminClient = await createPureClient();
  const prev = getPreviousRange(from, to);

  const [
    invitesCurrent,
    invitesPrev,
    deactivationCurrent,
    deactivationPrev,
    cancelledCurrent,
    cancelledPrev,
    roleChangeCurrent,
    roleChangePrev,
  ] = await Promise.all([
    adminClient
      .from("invitations")
      .select("id,status,created_at")
      .gte("created_at", `${from}T00:00:00.000Z`)
      .lte("created_at", `${to}T23:59:59.999Z`),
    adminClient
      .from("invitations")
      .select("id,status,created_at")
      .gte("created_at", `${prev.from}T00:00:00.000Z`)
      .lte("created_at", `${prev.to}T23:59:59.999Z`),
    adminClient
      .from("user_store_roles")
      .select("id,status,updated_at,deleted_at")
      .gte("updated_at", `${from}T00:00:00.000Z`)
      .lte("updated_at", `${to}T23:59:59.999Z`),
    adminClient
      .from("user_store_roles")
      .select("id,status,updated_at,deleted_at")
      .gte("updated_at", `${prev.from}T00:00:00.000Z`)
      .lte("updated_at", `${prev.to}T23:59:59.999Z`),
    adminClient
      .from("schedule_assignments")
      .select("id,status,date")
      .gte("date", from)
      .lte("date", to),
    adminClient
      .from("schedule_assignments")
      .select("id,status,date")
      .gte("date", prev.from)
      .lte("date", prev.to),
    adminClient
      .from("store_audit_logs")
      .select("id,table_name,created_at,action")
      .gte("created_at", `${from}T00:00:00.000Z`)
      .lte("created_at", `${to}T23:59:59.999Z`),
    adminClient
      .from("store_audit_logs")
      .select("id,table_name,created_at,action")
      .gte("created_at", `${prev.from}T00:00:00.000Z`)
      .lte("created_at", `${prev.to}T23:59:59.999Z`),
  ]);

  const inviteFailCurrent = (invitesCurrent.data || []).filter((row) =>
    FAIL_STATUSES.includes(row.status)
  ).length;
  const inviteFailPrev = (invitesPrev.data || []).filter((row) =>
    FAIL_STATUSES.includes(row.status)
  ).length;

  const deactivationCountCurrent = (deactivationCurrent.data || []).filter(
    (row) => row.status !== "ACTIVE" || row.deleted_at
  ).length;
  const deactivationCountPrev = (deactivationPrev.data || []).filter(
    (row) => row.status !== "ACTIVE" || row.deleted_at
  ).length;

  const cancelledCountCurrent = (cancelledCurrent.data || []).filter(
    (row) => row.status === "CANCELLED"
  ).length;
  const cancelledCountPrev = (cancelledPrev.data || []).filter(
    (row) => row.status === "CANCELLED"
  ).length;

  const roleChangeCountCurrent = (roleChangeCurrent.data || []).filter(
    (row) =>
      row.table_name === "user_store_roles" ||
      ["GRANT_ROLE", "REVOKE_ROLE", "ROLE_CHANGED"].includes(row.action)
  ).length;
  const roleChangeCountPrev = (roleChangePrev.data || []).filter(
    (row) =>
      row.table_name === "user_store_roles" ||
      ["GRANT_ROLE", "REVOKE_ROLE", "ROLE_CHANGED"].includes(row.action)
  ).length;

  const drafts: AnomalyDraft[] = [];
  const rules = [
    {
      key: "invite_failure_spike",
      title: "admin.anomaly.inviteFailure.title",
      description: "admin.anomaly.inviteFailure.description",
      current: inviteFailCurrent,
      baseline: inviteFailPrev,
    },
    {
      key: "user_deactivation_spike",
      title: "admin.anomaly.deactivation.title",
      description: "admin.anomaly.deactivation.description",
      current: deactivationCountCurrent,
      baseline: deactivationCountPrev,
    },
    {
      key: "assignment_gap_spike",
      title: "admin.anomaly.assignmentGap.title",
      description: "admin.anomaly.assignmentGap.description",
      current: cancelledCountCurrent,
      baseline: cancelledCountPrev,
    },
    {
      key: "role_change_spike",
      title: "admin.anomaly.roleChange.title",
      description: "admin.anomaly.roleChange.description",
      current: roleChangeCountCurrent,
      baseline: roleChangeCountPrev,
    },
  ];

  rules.forEach((rule) => {
    if (!shouldTrigger(rule.current, rule.baseline)) {
      return;
    }

    drafts.push({
      ruleKey: rule.key,
      title: rule.title,
      description: rule.description,
      metricValue: rule.current,
      baselineValue: rule.baseline,
      severity: toSeverity(rule.current, rule.baseline),
    });
  });

  return drafts;
};

export async function upsertDetectedAnomalies(from: string, to: string) {
  const adminClient = await createPureClient();
  const drafts = await detectAnomalies(from, to);

  if (drafts.length === 0) {
    return;
  }

  const payload = drafts.map((draft) => ({
    rule_key: draft.ruleKey,
    title: draft.title,
    description: draft.description,
    severity: draft.severity,
    status: "OPEN",
    detected_at: new Date().toISOString(),
    metric_value: draft.metricValue,
    baseline_value: draft.baselineValue,
    metadata: {
      source: "rule-engine-v1",
      period_from: from,
      period_to: to,
    },
  }));

  await adminClient.from("admin_anomalies").upsert(payload, {
    onConflict: "rule_key",
  });
}

export async function getAdminAnomalies(options: AdminQueryOptions) {
  await upsertDetectedAnomalies(options.from, options.to);

  const adminClient = await createPureClient();
  const { data = [] } = await adminClient
    .from("admin_anomalies")
    .select(
      "id,rule_key,title,description,severity,status,detected_at,metric_value,baseline_value,assigned_to,resolution_note"
    )
    .order("detected_at", { ascending: false });

  let items: AnomalyItem[] = data.map((row) => ({
    id: row.id,
    ruleKey: row.rule_key,
    title: row.title,
    description: row.description,
    severity: row.severity as AdminAnomalySeverity,
    status: row.status as AdminAnomalyStatus,
    detectedAt: row.detected_at,
    metricValue: Number(row.metric_value || 0),
    baselineValue: Number(row.baseline_value || 0),
    assignedTo: row.assigned_to,
    resolutionNote: row.resolution_note,
  }));

  if (options.status && options.status !== "ALL") {
    items = items.filter((item) => item.status === options.status);
  }

  if (options.severity && options.severity !== "ALL") {
    items = items.filter((item) => item.severity === options.severity);
  }

  const query = (options.q || "").trim().toLowerCase();
  if (query) {
    items = items.filter(
      (item) =>
        item.title.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.ruleKey.toLowerCase().includes(query)
    );
  }

  const paged = paginate(items, options.page, options.limit);

  return {
    anomalies: paged.items,
    pagination: {
      page: paged.page,
      limit: paged.limit,
      total: paged.total,
      totalPages: paged.totalPages,
    },
    summary: {
      open: items.filter((item) => item.status === "OPEN").length,
      ack: items.filter((item) => item.status === "ACK").length,
      resolved: items.filter((item) => item.status === "RESOLVED").length,
    },
  };
}

interface UpdateAnomalyInput {
  id: string;
  status: AdminAnomalyStatus;
  resolutionNote?: string;
  assignedTo?: string;
}

export async function updateAnomalyStatus(
  input: UpdateAnomalyInput,
  actor: UserProfile
) {
  const adminClient = await createPureClient();
  const { data, error } = await adminClient
    .from("admin_anomalies")
    .update({
      status: input.status,
      resolution_note: input.resolutionNote || null,
      assigned_to: input.assignedTo || null,
      detected_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .select(
      "id,rule_key,title,description,severity,status,detected_at,metric_value,baseline_value,assigned_to,resolution_note"
    )
    .single();

  if (error) {
    throw error;
  }

  await logPlatformAudit({
    actor,
    action: "UPDATE",
    eventType: "ANOMALY_STATUS_CHANGED",
    targetType: "admin_anomaly",
    targetId: input.id,
    severity: "MEDIUM",
    payload: {
      status: input.status,
      resolutionNote: input.resolutionNote || null,
      assignedTo: input.assignedTo || null,
    },
  });

  return {
    id: data.id,
    ruleKey: data.rule_key,
    title: data.title,
    description: data.description,
    severity: data.severity as AdminAnomalySeverity,
    status: data.status as AdminAnomalyStatus,
    detectedAt: data.detected_at,
    metricValue: Number(data.metric_value || 0),
    baselineValue: Number(data.baseline_value || 0),
    assignedTo: data.assigned_to,
    resolutionNote: data.resolution_note,
  } as AnomalyItem;
}

export async function getAdminAuditLogs(options: AdminQueryOptions) {
  const adminClient = await createPureClient();
  const platformQuery = adminClient
    .from("platform_audit_logs")
    .select(
      "id,actor_id,actor_email,actor_role,action,event_type,target_type,target_id,severity,event_payload,created_at"
    )
    .gte("created_at", `${options.from}T00:00:00.000Z`)
    .lte("created_at", `${options.to}T23:59:59.999Z`)
    .order("created_at", { ascending: false });

  const storeQuery = adminClient
    .from("store_audit_logs")
    .select(
      "id,user_id,action,table_name,target_type,target_id,event_type,severity,new_values,old_values,created_at"
    )
    .gte("created_at", `${options.from}T00:00:00.000Z`)
    .lte("created_at", `${options.to}T23:59:59.999Z`)
    .order("created_at", { ascending: false });

  const [platformRes, storeRes] = await Promise.all([platformQuery, storeQuery]);

  const platformRows = platformRes.data || [];
  const storeRows = storeRes.data || [];

  const actorIds = Array.from(
    new Set(
      storeRows
        .map((row) => row.user_id)
        .filter((value): value is string => typeof value === "string")
    )
  );

  const actorEmailMap = new Map<string, string>();
  await Promise.all(
    actorIds.map(async (actorId) => {
      const { data } = await adminClient.auth.admin.getUserById(actorId);
      actorEmailMap.set(actorId, data.user?.email || "");
    })
  );

  let logs: AdminAuditLogItem[] = [
    ...platformRows.map((row) => ({
      id: row.id,
      scope: "PLATFORM" as const,
      action: row.action,
      eventType: row.event_type,
      targetType: row.target_type || "platform",
      targetId: row.target_id || "",
      actorId: row.actor_id || "",
      actorEmail: row.actor_email || "",
      actorRole: row.actor_role || "",
      severity: row.severity || "LOW",
      createdAt: row.created_at,
      payload: (row.event_payload || {}) as Record<string, unknown>,
    })),
    ...storeRows.map((row) => ({
      id: row.id,
      scope: "STORE" as const,
      action: row.action,
      eventType: row.event_type || row.table_name,
      targetType: row.target_type || row.table_name || "store",
      targetId: row.target_id || "",
      actorId: row.user_id || "",
      actorEmail: row.user_id ? actorEmailMap.get(row.user_id) || "" : "",
      actorRole: "",
      severity: row.severity || "LOW",
      createdAt: row.created_at,
      payload: {
        oldValues: row.old_values || null,
        newValues: row.new_values || null,
      },
    })),
  ];

  if (options.severity && options.severity !== "ALL") {
    logs = logs.filter((log) => log.severity === options.severity);
  }

  if (options.eventType && options.eventType !== "ALL") {
    logs = logs.filter((log) => log.eventType === options.eventType);
  }

  const query = (options.q || "").trim().toLowerCase();
  if (query) {
    logs = logs.filter(
      (log) =>
        log.action.toLowerCase().includes(query) ||
        log.eventType.toLowerCase().includes(query) ||
        log.targetType.toLowerCase().includes(query) ||
        log.targetId.toLowerCase().includes(query) ||
        log.actorEmail.toLowerCase().includes(query)
    );
  }

  logs.sort(
    (a, b) =>
      (safeParseDate(b.createdAt)?.getTime() || 0) -
      (safeParseDate(a.createdAt)?.getTime() || 0)
  );

  const paged = paginate(logs, options.page, options.limit);

  return {
    logs: paged.items,
    pagination: {
      page: paged.page,
      limit: paged.limit,
      total: paged.total,
      totalPages: paged.totalPages,
    },
  };
}

interface PlatformAuditLogInput {
  actor: UserProfile;
  action: string;
  eventType: string;
  targetType?: string;
  targetId?: string;
  severity?: AdminAnomalySeverity;
  payload?: Record<string, unknown>;
}

export async function logPlatformAudit(input: PlatformAuditLogInput) {
  try {
    const adminClient = await createPureClient();
    await adminClient.from("platform_audit_logs").insert({
      actor_id: input.actor.id,
      actor_email: input.actor.email,
      actor_role: input.actor.platform_admin_role || null,
      action: input.action,
      event_type: input.eventType,
      target_type: input.targetType || null,
      target_id: input.targetId || null,
      severity: input.severity || "LOW",
      event_payload: input.payload || {},
    });
  } catch (error) {
    console.warn("platform audit log insert failed", error);
  }
}

export async function getAdminExportData(
  resource: string,
  from: string,
  to: string
): Promise<{ headers: string[]; rows: Array<Array<string | number>> }> {
  switch (resource) {
    case "overview": {
      const overview = await getAdminOverview(from, to);
      return {
        headers: ["metric", "value"],
        rows: [
          ["totalUsers", overview.summary.totalUsers],
          ["activeUsers", overview.summary.activeUsers],
          ["inactiveUsers", overview.summary.inactiveUsers],
          ["totalStores", overview.summary.totalStores],
          ["activeStores", overview.summary.activeStores],
          ["archivedStores", overview.summary.archivedStores],
          ["pendingInvitations", overview.summary.pendingInvitations],
          ["assignmentCoverageRate", overview.summary.assignmentCoverageRate],
        ],
      };
    }
    case "users": {
      const usersData = await getAdminUsers({ from, to, page: 1, limit: 1000 });
      return {
        headers: [
          "id",
          "email",
          "name",
          "platformRole",
          "status",
          "lastSignInAt",
          "createdAt",
          "storeRoleCount",
        ],
        rows: usersData.users.map((user) => [
          user.id,
          user.email,
          user.name,
          user.platformRole || "",
          user.status,
          user.lastSignInAt || "",
          user.createdAt,
          user.storeRoleCount,
        ]),
      };
    }
    case "stores": {
      const storesData = await getAdminStores({ from, to, page: 1, limit: 1000 });
      return {
        headers: [
          "id",
          "name",
          "status",
          "ownerEmail",
          "memberCount",
          "managerCount",
          "pendingInvitations",
          "assignmentCount30d",
          "riskScore",
          "riskLevel",
        ],
        rows: storesData.stores.map((store) => [
          store.id,
          store.name,
          store.status,
          store.ownerEmail,
          store.memberCount,
          store.managerCount,
          store.pendingInvitations,
          store.assignmentCount30d,
          store.riskScore,
          store.riskLevel,
        ]),
      };
    }
    case "anomalies": {
      const anomaliesData = await getAdminAnomalies({
        from,
        to,
        page: 1,
        limit: 1000,
      });
      return {
        headers: [
          "id",
          "ruleKey",
          "title",
          "severity",
          "status",
          "metricValue",
          "baselineValue",
          "detectedAt",
        ],
        rows: anomaliesData.anomalies.map((item) => [
          item.id,
          item.ruleKey,
          item.title,
          item.severity,
          item.status,
          item.metricValue,
          item.baselineValue,
          item.detectedAt,
        ]),
      };
    }
    case "audit-logs": {
      const logsData = await getAdminAuditLogs({
        from,
        to,
        page: 1,
        limit: 1000,
      });
      return {
        headers: [
          "id",
          "scope",
          "action",
          "eventType",
          "targetType",
          "targetId",
          "actorEmail",
          "severity",
          "createdAt",
        ],
        rows: logsData.logs.map((log) => [
          log.id,
          log.scope,
          log.action,
          log.eventType,
          log.targetType,
          log.targetId,
          log.actorEmail,
          log.severity,
          log.createdAt,
        ]),
      };
    }
    default:
      throw new Error("UNSUPPORTED_EXPORT_RESOURCE");
  }
}

export function getDefaultDateRange() {
  const to = format(new Date(), DATE_FMT);
  const from = format(subDays(new Date(), 7), DATE_FMT);

  return { from, to };
}

export function parseAdminStatus(value: string): AdminAnomalyStatus {
  if (value === "ACK" || value === "RESOLVED" || value === "OPEN") {
    return value;
  }

  throw new Error("INVALID_STATUS");
}

export function sanitizeDateRange(from?: string | null, to?: string | null) {
  if (!from || !to) {
    return getDefaultDateRange();
  }

  const fromDate = safeParseDate(from);
  const toDate = safeParseDate(to);
  if (!fromDate || !toDate) {
    throw new Error("INVALID_DATE_RANGE");
  }

  if (fromDate > toDate) {
    return {
      from: format(toDate, DATE_FMT),
      to: format(fromDate, DATE_FMT),
    };
  }

  return {
    from: format(fromDate, DATE_FMT),
    to: format(toDate, DATE_FMT),
  };
}

export function getRangeFromPeriod(period: string) {
  const today = new Date();
  const fromDate =
    period === "30d"
      ? subDays(today, 30)
      : period === "today"
        ? today
        : subDays(today, 7);

  return {
    from: format(fromDate, DATE_FMT),
    to: format(today, DATE_FMT),
  };
}

export function normalizeRangeQuery(
  period?: string | null,
  from?: string | null,
  to?: string | null
) {
  if (from && to) {
    return sanitizeDateRange(from, to);
  }

  return getRangeFromPeriod(period || "7d");
}

export function getPreviousPeriodRange(from: string, to: string) {
  const prev = getPreviousRange(from, to);
  return {
    ...prev,
    nextFrom: format(addDays(parseISO(prev.to), 1), DATE_FMT),
  };
}
