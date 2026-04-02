"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { AdminLoadingState, AdminPageHeader, AdminPanel, AdminPanelHeading, AdminStatCard, AdminErrorState, AdminEmptyState } from "@/components/admin/admin-ui";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAdminQueryState } from "@/hooks/use-admin-query-state";
import { fetchAdminJson, formatAdminDate, type AdminPeriodOption } from "@/lib/admin/client";
import { t, type Locale } from "@/lib/i18n";
import { defaultLocale } from "@/lib/i18n-config";
import type { AdminOverviewData } from "@/types/admin";

function useOverviewUrl(
  period: AdminPeriodOption,
  from: string,
  to: string
) {
  return useMemo(() => {
    const params = new URLSearchParams();
    params.set("period", period);
    if (from) {
      params.set("from", from);
    }
    if (to) {
      params.set("to", to);
    }

    return `/api/admin/overview?${params.toString()}`;
  }, [from, period, to]);
}

export default function AdminOverviewPage() {
  const params = useParams();
  const currentLocale = (params.locale as Locale) || defaultLocale;
  const { query } = useAdminQueryState();
  const requestUrl = useOverviewUrl(query.period, query.from, query.to);

  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isActive = true;

    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const next = await fetchAdminJson<AdminOverviewData>(requestUrl);
        if (!isActive) {
          return;
        }

        setData(next);
      } catch (loadError) {
        console.error("Admin overview page error:", loadError);
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

  if (loading && !data) {
    return <AdminLoadingState locale={currentLocale} />;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={t("admin.title", currentLocale)}
        description={t("admin.overview.description", currentLocale)}
      />

      {error ? <AdminErrorState message={error} /> : null}

      {data ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <AdminStatCard
              label={t("admin.kpi.totalUsers", currentLocale)}
              value={data.summary.totalUsers}
            />
            <AdminStatCard
              label={t("admin.kpi.activeUsers", currentLocale)}
              value={data.summary.activeUsers}
            />
            <AdminStatCard
              label={t("admin.kpi.activeStores", currentLocale)}
              value={data.summary.activeStores}
            />
            <AdminStatCard
              label={t("admin.kpi.coverage", currentLocale)}
              value={`${data.summary.assignmentCoverageRate}%`}
            />
          </div>

          <AdminPanel>
            <AdminPanelHeading
              title={t("admin.trends.title", currentLocale)}
              description={t("admin.overview.trendsDescription", currentLocale)}
              actions={
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <ShieldCheck className="h-4 w-4 text-cyan-300" />
                  <span>
                    {formatAdminDate(data.period.from, currentLocale)} -{" "}
                    {formatAdminDate(data.period.to, currentLocale)}
                  </span>
                </div>
              }
            />

            {data.trends.length === 0 ? (
              <AdminEmptyState
                title={t("admin.empty.title", currentLocale)}
                description={t("admin.empty.description", currentLocale)}
              />
            ) : (
              <Table className="text-slate-100">
                <TableHeader className="bg-white/[0.03]">
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-slate-400">
                      {t("admin.trends.date", currentLocale)}
                    </TableHead>
                    <TableHead className="text-slate-400">
                      {t("admin.trends.users", currentLocale)}
                    </TableHead>
                    <TableHead className="text-slate-400">
                      {t("admin.trends.stores", currentLocale)}
                    </TableHead>
                    <TableHead className="text-slate-400">
                      {t("admin.trends.invitations", currentLocale)}
                    </TableHead>
                    <TableHead className="text-slate-400">
                      {t("admin.trends.assignments", currentLocale)}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.trends.map((row) => (
                    <TableRow
                      key={row.date}
                      className="border-white/10 hover:bg-white/[0.03]"
                    >
                      <TableCell>{formatAdminDate(row.date, currentLocale)}</TableCell>
                      <TableCell>{row.users}</TableCell>
                      <TableCell>{row.stores}</TableCell>
                      <TableCell>{row.invitations}</TableCell>
                      <TableCell>{row.assignments}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </AdminPanel>
        </>
      ) : null}
    </div>
  );
}
