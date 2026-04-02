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
