"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AdminEmptyState,
  AdminErrorState,
  AdminLoadingState,
  AdminPageHeader,
  AdminPagination,
  AdminPanel,
  AdminPanelHeading,
  AdminPill,
} from "@/components/admin/admin-ui";
import { useAdminQueryState } from "@/hooks/use-admin-query-state";
import { fetchAdminJson, formatAdminDateTime } from "@/lib/admin/client";
import { defaultLocale } from "@/lib/i18n-config";
import { t, type Locale } from "@/lib/i18n";
import { useAuth } from "@/contexts/auth-context";
import { PlatformAdminRole } from "@/types/auth";
import type { AdminAnomaliesData, AnomalyItem } from "@/types/admin";

function getSeverityTone(severity: AnomalyItem["severity"]) {
  if (severity === "HIGH") {
    return "rose";
  }

  if (severity === "MEDIUM") {
    return "amber";
  }

  return "emerald";
}

function getStatusTone(status: AnomalyItem["status"]) {
  if (status === "OPEN") {
    return "amber";
  }

  if (status === "ACK") {
    return "cyan";
  }

  return "emerald";
}

export default function AdminAnomaliesPage() {
  const params = useParams();
  const currentLocale = (params.locale as Locale) || defaultLocale;
  const { query, updateQuery, setPage } = useAdminQueryState();
  const { user } = useAuth();
  const canWrite =
    user?.platform_admin_role === PlatformAdminRole.SYSTEM_ADMIN ||
    user?.platform_admin_role === PlatformAdminRole.OPS_ANALYST;

  const requestUrl = useMemo(() => {
    const searchParams = new URLSearchParams();
    searchParams.set("period", query.period);
    searchParams.set("page", String(query.page));
    searchParams.set("limit", "12");
    if (query.q) {
      searchParams.set("q", query.q);
    }
    if (query.from) {
      searchParams.set("from", query.from);
    }
    if (query.to) {
      searchParams.set("to", query.to);
    }
    if (query.status !== "ALL") {
      searchParams.set("status", query.status);
    }
    if (query.severity !== "ALL") {
      searchParams.set("severity", query.severity);
    }

    return `/api/admin/anomalies?${searchParams.toString()}`;
  }, [query.from, query.page, query.period, query.q, query.severity, query.status, query.to]);

  const [data, setData] = useState<AdminAnomaliesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState("");

  useEffect(() => {
    let isActive = true;

    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const next = await fetchAdminJson<AdminAnomaliesData>(requestUrl);
        if (isActive) {
          setData(next);
        }
      } catch (loadError) {
        console.error("Admin anomalies page error:", loadError);
        if (isActive) {
          setError(t("admin.loadError", currentLocale));
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      isActive = false;
    };
  }, [currentLocale, requestUrl]);

  const refresh = async () => {
    const next = await fetchAdminJson<AdminAnomaliesData>(requestUrl);
    setData(next);
  };

  const updateStatus = async (id: string, status: "ACK" | "RESOLVED") => {
    setUpdatingId(id);
    setError("");

    try {
      const response = await fetch(`/api/admin/anomalies/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "FAILED_TO_UPDATE_ANOMALY");
      }

      await refresh();
    } catch (updateError) {
      console.error("Admin anomaly update error:", updateError);
      setError(t("admin.anomalies.updateError", currentLocale));
    } finally {
      setUpdatingId("");
    }
  };

  if (loading && !data) {
    return <AdminLoadingState locale={currentLocale} />;
  }

  const anomalies = data?.anomalies || [];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={t("admin.anomalies.title", currentLocale)}
        description={t("admin.anomalies.description", currentLocale)}
      />

      {error ? <AdminErrorState message={error} /> : null}

      {data ? (
        <AdminPanel>
          <AdminPanelHeading
            title={t("admin.anomalies.title", currentLocale)}
            description={t("admin.anomalies.summaryDescription", currentLocale)}
            actions={
              <div className="flex flex-col gap-2 sm:flex-row">
                <Select
                  value={query.status}
                  onValueChange={(value) =>
                    updateQuery({ status: value }, { resetPage: true })
                  }
                >
                  <SelectTrigger className="w-full border-white/10 bg-slate-950/65 text-slate-100 focus:ring-cyan-400/70 focus:ring-offset-slate-900 sm:w-44">
                    <SelectValue placeholder={t("admin.anomalies.status", currentLocale)} />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-slate-950 text-slate-100">
                    <SelectItem value="ALL">{t("admin.anomalies.allStatuses", currentLocale)}</SelectItem>
                    <SelectItem value="OPEN">{t("admin.anomalyStatus.open", currentLocale)}</SelectItem>
                    <SelectItem value="ACK">{t("admin.anomalyStatus.ack", currentLocale)}</SelectItem>
                    <SelectItem value="RESOLVED">{t("admin.anomalyStatus.resolved", currentLocale)}</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={query.severity}
                  onValueChange={(value) =>
                    updateQuery({ severity: value }, { resetPage: true })
                  }
                >
                  <SelectTrigger className="w-full border-white/10 bg-slate-950/65 text-slate-100 focus:ring-cyan-400/70 focus:ring-offset-slate-900 sm:w-44">
                    <SelectValue placeholder={t("admin.anomalies.severity", currentLocale)} />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-slate-950 text-slate-100">
                    <SelectItem value="ALL">{t("admin.anomalies.allSeverities", currentLocale)}</SelectItem>
                    <SelectItem value="HIGH">{t("admin.severity.high", currentLocale)}</SelectItem>
                    <SelectItem value="MEDIUM">{t("admin.severity.medium", currentLocale)}</SelectItem>
                    <SelectItem value="LOW">{t("admin.severity.low", currentLocale)}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            }
          />

          {anomalies.length === 0 ? (
            <AdminEmptyState
              title={t("admin.empty.title", currentLocale)}
              description={t("admin.anomalies.emptyDescription", currentLocale)}
            />
          ) : (
            <>
              <Table className="text-slate-100">
                <TableHeader className="bg-white/[0.03]">
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-slate-400">{t("admin.anomalies.rule", currentLocale)}</TableHead>
                    <TableHead className="text-slate-400">{t("admin.anomalies.severity", currentLocale)}</TableHead>
                    <TableHead className="text-slate-400">{t("admin.anomalies.status", currentLocale)}</TableHead>
                    <TableHead className="text-slate-400">{t("admin.anomalies.metric", currentLocale)}</TableHead>
                    <TableHead className="text-slate-400">{t("admin.anomalies.detectedAt", currentLocale)}</TableHead>
                    <TableHead className="text-slate-400">{t("admin.anomalies.actions", currentLocale)}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {anomalies.map((item) => (
                    <TableRow key={item.id} className="border-white/10 hover:bg-white/[0.03]">
                      <TableCell>
                        <div className="flex gap-3">
                          <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-300" />
                          <div className="space-y-1">
                            <p className="font-medium text-white">
                              {t(item.title, currentLocale)}
                            </p>
                            <p className="text-sm text-slate-400">
                              {t(item.description, currentLocale)}
                            </p>
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                              {item.ruleKey}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <AdminPill tone={getSeverityTone(item.severity)}>
                          {t(`admin.severity.${item.severity.toLowerCase()}`, currentLocale)}
                        </AdminPill>
                      </TableCell>
                      <TableCell>
                        <AdminPill tone={getStatusTone(item.status)}>
                          {t(`admin.anomalyStatus.${item.status.toLowerCase()}`, currentLocale)}
                        </AdminPill>
                      </TableCell>
                      <TableCell>
                        {item.metricValue} / {item.baselineValue}
                      </TableCell>
                      <TableCell>{formatAdminDateTime(item.detectedAt, currentLocale)}</TableCell>
                      <TableCell>
                        {canWrite ? (
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="border-white/10 bg-slate-950/55 text-slate-200 hover:bg-slate-800 hover:text-white"
                              disabled={
                                updatingId === item.id ||
                                item.status === "ACK" ||
                                item.status === "RESOLVED"
                              }
                              onClick={() => updateStatus(item.id, "ACK")}
                            >
                              {t("admin.anomalies.ack", currentLocale)}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              className="bg-cyan-400 text-slate-950 hover:bg-cyan-300"
                              disabled={updatingId === item.id || item.status === "RESOLVED"}
                              onClick={() => updateStatus(item.id, "RESOLVED")}
                            >
                              {t("admin.anomalies.resolve", currentLocale)}
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">
                            {t("admin.readOnly", currentLocale)}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <AdminPagination
                locale={currentLocale}
                page={data.pagination.page}
                totalPages={data.pagination.totalPages}
                onPrev={() => setPage(Math.max(data.pagination.page - 1, 1))}
                onNext={() => setPage(Math.min(data.pagination.page + 1, data.pagination.totalPages))}
              />
            </>
          )}
        </AdminPanel>
      ) : null}
    </div>
  );
}
