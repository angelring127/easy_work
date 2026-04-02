"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AlertTriangle, Download, Loader2, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { ResponsiveHeader } from "@/components/layout/responsive-header";
import { UserRole, PlatformAdminRole } from "@/types/auth";
import { t, type Locale } from "@/lib/i18n";
import { defaultLocale } from "@/lib/i18n-config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type TabKey = "overview" | "users" | "stores" | "anomalies" | "logs";

const PERIOD_OPTIONS = ["today", "7d", "30d"] as const;

const TAB_TO_EXPORT_RESOURCE: Record<TabKey, string> = {
  overview: "overview",
  users: "users",
  stores: "stores",
  anomalies: "anomalies",
  logs: "audit-logs",
};

interface OverviewPayload {
  summary: {
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
    totalStores: number;
    activeStores: number;
    archivedStores: number;
    pendingInvitations: number;
    assignmentCoverageRate: number;
  };
  trends: Array<{
    date: string;
    users: number;
    stores: number;
    invitations: number;
    assignments: number;
  }>;
}

interface PagedResponse<T> {
  data: {
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  } & T;
}

export default function AdminDashboardPage() {
  const { locale } = useParams();
  const router = useRouter();
  const currentLocale = (locale as Locale) || defaultLocale;
  const { user, loading, signOut } = useAuth();

  const [period, setPeriod] = useState<(typeof PERIOD_OPTIONS)[number]>("7d");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [overview, setOverview] = useState<OverviewPayload | null>(null);
  const [usersData, setUsersData] = useState<PagedResponse<{ users: any[] }> | null>(
    null
  );
  const [storesData, setStoresData] = useState<PagedResponse<{ stores: any[] }> | null>(
    null
  );
  const [anomaliesData, setAnomaliesData] = useState<
    PagedResponse<{ anomalies: any[] }>
  | null>(null);
  const [logsData, setLogsData] = useState<PagedResponse<{ logs: any[] }> | null>(
    null
  );

  const [userPage, setUserPage] = useState(1);
  const [storePage, setStorePage] = useState(1);
  const [anomalyPage, setAnomalyPage] = useState(1);
  const [logPage, setLogPage] = useState(1);

  const platformRole = user?.platform_admin_role || null;
  const hasPlatformAccess = Boolean(platformRole);
  const canWriteAnomalies =
    platformRole === PlatformAdminRole.SYSTEM_ADMIN ||
    platformRole === PlatformAdminRole.OPS_ANALYST;

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    params.set("period", period);
    if (search.trim()) {
      params.set("q", search.trim());
    }
    if (fromDate && toDate) {
      params.set("from", fromDate);
      params.set("to", toDate);
    }

    return params;
  }, [period, search, fromDate, toDate]);

  const loadData = useCallback(async () => {
    if (!hasPlatformAccess) {
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const base = buildQuery();
      const userQuery = new URLSearchParams(base);
      const storeQuery = new URLSearchParams(base);
      const anomalyQuery = new URLSearchParams(base);
      const logQuery = new URLSearchParams(base);

      userQuery.set("page", String(userPage));
      userQuery.set("limit", "10");
      storeQuery.set("page", String(storePage));
      storeQuery.set("limit", "10");
      anomalyQuery.set("page", String(anomalyPage));
      anomalyQuery.set("limit", "10");
      logQuery.set("page", String(logPage));
      logQuery.set("limit", "10");

      const [overviewRes, usersRes, storesRes, anomaliesRes, logsRes] =
        await Promise.all([
          fetch(`/api/admin/overview?${base.toString()}`),
          fetch(`/api/admin/users?${userQuery.toString()}`),
          fetch(`/api/admin/stores?${storeQuery.toString()}`),
          fetch(`/api/admin/anomalies?${anomalyQuery.toString()}`),
          fetch(`/api/admin/audit-logs?${logQuery.toString()}`),
        ]);

      if (
        !overviewRes.ok ||
        !usersRes.ok ||
        !storesRes.ok ||
        !anomaliesRes.ok ||
        !logsRes.ok
      ) {
        throw new Error("FAILED_TO_FETCH_ADMIN_DATA");
      }

      const [overviewJson, usersJson, storesJson, anomaliesJson, logsJson] =
        await Promise.all([
          overviewRes.json(),
          usersRes.json(),
          storesRes.json(),
          anomaliesRes.json(),
          logsRes.json(),
        ]);

      setOverview(overviewJson.data || null);
      setUsersData(usersJson || null);
      setStoresData(storesJson || null);
      setAnomaliesData(anomaliesJson || null);
      setLogsData(logsJson || null);
    } catch (loadError) {
      console.error("Admin dashboard load error:", loadError);
      setError(t("admin.loadError", currentLocale));
    } finally {
      setIsLoading(false);
    }
  }, [
    hasPlatformAccess,
    buildQuery,
    userPage,
    storePage,
    anomalyPage,
    logPage,
    currentLocale,
  ]);

  useEffect(() => {
    if (!loading && !user) {
      router.push(`/${locale}/admin/login`);
      return;
    }

    if (!loading && user && !hasPlatformAccess) {
      router.push(`/${locale}/dashboard`);
      return;
    }

    loadData();
  }, [loading, user, hasPlatformAccess, router, locale, loadData]);

  const handleSignOut = async () => {
    await signOut();
  };

  const handleExport = async () => {
    const params = buildQuery();
    params.set("resource", TAB_TO_EXPORT_RESOURCE[activeTab]);
    window.open(`/api/admin/export?${params.toString()}`, "_blank");
  };

  const updateAnomalyStatus = async (id: string, status: "ACK" | "RESOLVED") => {
    try {
      const response = await fetch(`/api/admin/anomalies/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error("FAILED_TO_UPDATE_ANOMALY");
      }

      loadData();
    } catch (patchError) {
      console.error("Anomaly update failed:", patchError);
      setError(t("admin.anomalies.updateError", currentLocale));
    }
  };

  const paginationByTab = useMemo(
    () => ({
      users: usersData?.data?.pagination,
      stores: storesData?.data?.pagination,
      anomalies: anomaliesData?.data?.pagination,
      logs: logsData?.data?.pagination,
    }),
    [usersData, storesData, anomaliesData, logsData]
  );

  const getStatusLabel = (value: string) =>
    t(`admin.status.${value.toLowerCase()}`, currentLocale);
  const getRiskLabel = (value: string) =>
    t(`admin.risk.${value.toLowerCase()}`, currentLocale);
  const getSeverityLabel = (value: string) =>
    t(`admin.severity.${value.toLowerCase()}`, currentLocale);
  const getAnomalyStatusLabel = (value: string) =>
    t(`admin.anomalyStatus.${value.toLowerCase()}`, currentLocale);
  const getScopeLabel = (value: string) =>
    t(`admin.logs.scope.${value.toLowerCase()}`, currentLocale);

  if (loading || (!overview && isLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user || !hasPlatformAccess) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ResponsiveHeader
        userEmail={user.email}
        currentStoreRole={(user.role as UserRole) || UserRole.PART_TIMER}
        locale={locale as string}
        onLogout={handleSignOut}
      />

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <ShieldCheck className="h-6 w-6" />
                {t("admin.title", currentLocale)}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {t("admin.description", currentLocale)}
              </p>
            </div>
            <Button onClick={handleExport} className="gap-2">
              <Download className="h-4 w-4" />
              {t("admin.exportCurrent", currentLocale)}
            </Button>
          </CardHeader>

          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Select
              value={period}
              onValueChange={(value) =>
                setPeriod(value as (typeof PERIOD_OPTIONS)[number])
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t("admin.period", currentLocale)} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">{t("admin.period.today", currentLocale)}</SelectItem>
                <SelectItem value="7d">{t("admin.period.7d", currentLocale)}</SelectItem>
                <SelectItem value="30d">{t("admin.period.30d", currentLocale)}</SelectItem>
              </SelectContent>
            </Select>

            <Input
              value={fromDate}
              type="date"
              onChange={(e) => setFromDate(e.target.value)}
              aria-label={t("admin.period.from", currentLocale)}
            />

            <Input
              value={toDate}
              type="date"
              onChange={(e) => setToDate(e.target.value)}
              aria-label={t("admin.period.to", currentLocale)}
            />

            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("admin.searchPlaceholder", currentLocale)}
            />
          </CardContent>
        </Card>

        {error && (
          <Card className="border-red-300 bg-red-50">
            <CardContent className="pt-6 text-sm text-red-700">{error}</CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabKey)}>
          <TabsList className="grid grid-cols-5 w-full md:w-auto">
            <TabsTrigger value="overview">{t("admin.tab.overview", currentLocale)}</TabsTrigger>
            <TabsTrigger value="users">{t("admin.tab.users", currentLocale)}</TabsTrigger>
            <TabsTrigger value="stores">{t("admin.tab.stores", currentLocale)}</TabsTrigger>
            <TabsTrigger value="anomalies">{t("admin.tab.anomalies", currentLocale)}</TabsTrigger>
            <TabsTrigger value="logs">{t("admin.tab.logs", currentLocale)}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">
                    {t("admin.kpi.totalUsers", currentLocale)}
                  </p>
                  <p className="text-2xl font-semibold">{overview?.summary.totalUsers || 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">
                    {t("admin.kpi.activeUsers", currentLocale)}
                  </p>
                  <p className="text-2xl font-semibold">{overview?.summary.activeUsers || 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">
                    {t("admin.kpi.activeStores", currentLocale)}
                  </p>
                  <p className="text-2xl font-semibold">{overview?.summary.activeStores || 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">
                    {t("admin.kpi.coverage", currentLocale)}
                  </p>
                  <p className="text-2xl font-semibold">
                    {overview?.summary.assignmentCoverageRate || 0}%
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>{t("admin.trends.title", currentLocale)}</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("admin.trends.date", currentLocale)}</TableHead>
                      <TableHead>{t("admin.trends.users", currentLocale)}</TableHead>
                      <TableHead>{t("admin.trends.stores", currentLocale)}</TableHead>
                      <TableHead>{t("admin.trends.invitations", currentLocale)}</TableHead>
                      <TableHead>{t("admin.trends.assignments", currentLocale)}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(overview?.trends || []).map((row) => (
                      <TableRow key={row.date}>
                        <TableCell>{row.date}</TableCell>
                        <TableCell>{row.users}</TableCell>
                        <TableCell>{row.stores}</TableCell>
                        <TableCell>{row.invitations}</TableCell>
                        <TableCell>{row.assignments}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t("admin.users.title", currentLocale)}</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("admin.users.email", currentLocale)}</TableHead>
                      <TableHead>{t("admin.users.name", currentLocale)}</TableHead>
                      <TableHead>{t("admin.users.platformRole", currentLocale)}</TableHead>
                      <TableHead>{t("admin.users.status", currentLocale)}</TableHead>
                      <TableHead>{t("admin.users.lastSignIn", currentLocale)}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(usersData?.data.users || []).map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.email}</TableCell>
                        <TableCell>{item.name}</TableCell>
                        <TableCell>
                          {item.platformRole || t("admin.role.none", currentLocale)}
                        </TableCell>
                        <TableCell>{getStatusLabel(item.status)}</TableCell>
                        <TableCell>{item.lastSignInAt || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="mt-4 flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={(paginationByTab.users?.page || 1) <= 1}
                    onClick={() => setUserPage((prev) => Math.max(prev - 1, 1))}
                  >
                    {t("admin.pagination.prev", currentLocale)}
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {paginationByTab.users?.page || 1} / {paginationByTab.users?.totalPages || 1}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={
                      (paginationByTab.users?.page || 1) >=
                      (paginationByTab.users?.totalPages || 1)
                    }
                    onClick={() => setUserPage((prev) => prev + 1)}
                  >
                    {t("admin.pagination.next", currentLocale)}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stores" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t("admin.stores.title", currentLocale)}</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("admin.stores.name", currentLocale)}</TableHead>
                      <TableHead>{t("admin.stores.status", currentLocale)}</TableHead>
                      <TableHead>{t("admin.stores.owner", currentLocale)}</TableHead>
                      <TableHead>{t("admin.stores.members", currentLocale)}</TableHead>
                      <TableHead>{t("admin.stores.risk", currentLocale)}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(storesData?.data.stores || []).map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.name}</TableCell>
                        <TableCell>{getStatusLabel(item.status)}</TableCell>
                        <TableCell>{item.ownerEmail || "-"}</TableCell>
                        <TableCell>{item.memberCount}</TableCell>
                        <TableCell>{getRiskLabel(item.riskLevel)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="mt-4 flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={(paginationByTab.stores?.page || 1) <= 1}
                    onClick={() => setStorePage((prev) => Math.max(prev - 1, 1))}
                  >
                    {t("admin.pagination.prev", currentLocale)}
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {paginationByTab.stores?.page || 1} / {paginationByTab.stores?.totalPages || 1}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={
                      (paginationByTab.stores?.page || 1) >=
                      (paginationByTab.stores?.totalPages || 1)
                    }
                    onClick={() => setStorePage((prev) => prev + 1)}
                  >
                    {t("admin.pagination.next", currentLocale)}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="anomalies" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t("admin.anomalies.title", currentLocale)}</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("admin.anomalies.rule", currentLocale)}</TableHead>
                      <TableHead>{t("admin.anomalies.severity", currentLocale)}</TableHead>
                      <TableHead>{t("admin.anomalies.status", currentLocale)}</TableHead>
                      <TableHead>{t("admin.anomalies.metric", currentLocale)}</TableHead>
                      <TableHead>{t("admin.anomalies.detectedAt", currentLocale)}</TableHead>
                      <TableHead>{t("admin.anomalies.actions", currentLocale)}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(anomaliesData?.data.anomalies || []).map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-500" />
                            <div>
                              <p className="font-medium">
                                {t(item.title, currentLocale)}
                              </p>
                              <p className="text-xs text-muted-foreground">{item.ruleKey}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getSeverityLabel(item.severity)}</TableCell>
                        <TableCell>{getAnomalyStatusLabel(item.status)}</TableCell>
                        <TableCell>
                          {item.metricValue} / {item.baselineValue}
                        </TableCell>
                        <TableCell>{item.detectedAt}</TableCell>
                        <TableCell>
                          {canWriteAnomalies ? (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateAnomalyStatus(item.id, "ACK")}
                                disabled={item.status === "ACK" || item.status === "RESOLVED"}
                              >
                                {t("admin.anomalies.ack", currentLocale)}
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => updateAnomalyStatus(item.id, "RESOLVED")}
                                disabled={item.status === "RESOLVED"}
                              >
                                {t("admin.anomalies.resolve", currentLocale)}
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {t("admin.readOnly", currentLocale)}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="mt-4 flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={(paginationByTab.anomalies?.page || 1) <= 1}
                    onClick={() => setAnomalyPage((prev) => Math.max(prev - 1, 1))}
                  >
                    {t("admin.pagination.prev", currentLocale)}
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {paginationByTab.anomalies?.page || 1} / {paginationByTab.anomalies?.totalPages || 1}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={
                      (paginationByTab.anomalies?.page || 1) >=
                      (paginationByTab.anomalies?.totalPages || 1)
                    }
                    onClick={() => setAnomalyPage((prev) => prev + 1)}
                  >
                    {t("admin.pagination.next", currentLocale)}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t("admin.logs.title", currentLocale)}</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("admin.logs.scope", currentLocale)}</TableHead>
                      <TableHead>{t("admin.logs.eventType", currentLocale)}</TableHead>
                      <TableHead>{t("admin.logs.actor", currentLocale)}</TableHead>
                      <TableHead>{t("admin.logs.severity", currentLocale)}</TableHead>
                      <TableHead>{t("admin.logs.createdAt", currentLocale)}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(logsData?.data.logs || []).map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{getScopeLabel(item.scope)}</TableCell>
                        <TableCell>{item.eventType}</TableCell>
                        <TableCell>{item.actorEmail || "-"}</TableCell>
                        <TableCell>{getSeverityLabel(item.severity)}</TableCell>
                        <TableCell>{item.createdAt}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="mt-4 flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={(paginationByTab.logs?.page || 1) <= 1}
                    onClick={() => setLogPage((prev) => Math.max(prev - 1, 1))}
                  >
                    {t("admin.pagination.prev", currentLocale)}
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {paginationByTab.logs?.page || 1} / {paginationByTab.logs?.totalPages || 1}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={
                      (paginationByTab.logs?.page || 1) >=
                      (paginationByTab.logs?.totalPages || 1)
                    }
                    onClick={() => setLogPage((prev) => prev + 1)}
                  >
                    {t("admin.pagination.next", currentLocale)}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
