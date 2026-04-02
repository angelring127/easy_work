import { PlatformAdminRole } from "@/types/auth";

export interface AdminKpiSummary {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  totalStores: number;
  activeStores: number;
  archivedStores: number;
  pendingInvitations: number;
  assignmentCoverageRate: number;
}

export interface AdminTrendPoint {
  date: string;
  users: number;
  stores: number;
  invitations: number;
  assignments: number;
}

export type AdminAnomalySeverity = "HIGH" | "MEDIUM" | "LOW";
export type AdminAnomalyStatus = "OPEN" | "ACK" | "RESOLVED";

export interface AnomalyItem {
  id: string;
  ruleKey: string;
  title: string;
  description: string;
  severity: AdminAnomalySeverity;
  status: AdminAnomalyStatus;
  detectedAt: string;
  metricValue: number;
  baselineValue: number;
  assignedTo: string | null;
  resolutionNote: string | null;
}

export interface AdminActor {
  id: string;
  email: string;
  platformRole: PlatformAdminRole | null;
}

export interface AdminPeriod {
  from: string;
  to: string;
}

export interface AdminPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AdminOverviewData {
  summary: AdminKpiSummary;
  trends: AdminTrendPoint[];
  period: AdminPeriod;
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

export interface AdminUsersData {
  users: AdminUserItem[];
  pagination: AdminPagination;
  summary: {
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
  };
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

export interface AdminStoresData {
  stores: AdminStoreItem[];
  pagination: AdminPagination;
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

export interface AdminAuditLogsData {
  logs: AdminAuditLogItem[];
  pagination: AdminPagination;
}

export interface AdminAnomaliesData {
  anomalies: AnomalyItem[];
  pagination: AdminPagination;
}

export interface AdminApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
