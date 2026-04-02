"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  AdminStatCard,
} from "@/components/admin/admin-ui";
import { useAdminQueryState } from "@/hooks/use-admin-query-state";
import { fetchAdminJson, formatAdminDateTime } from "@/lib/admin/client";
import { defaultLocale } from "@/lib/i18n-config";
import { t, type Locale } from "@/lib/i18n";
import { PlatformAdminRole } from "@/types/auth";
import type { AdminUsersData } from "@/types/admin";

export default function AdminUsersPage() {
  const params = useParams();
  const currentLocale = (params.locale as Locale) || defaultLocale;
  const { query, updateQuery, setPage } = useAdminQueryState();

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
    if (query.platformRole !== "ALL") {
      searchParams.set("platformRole", query.platformRole);
    }

    return `/api/admin/users?${searchParams.toString()}`;
  }, [query.from, query.page, query.period, query.platformRole, query.q, query.status, query.to]);

  const [data, setData] = useState<AdminUsersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isActive = true;

    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const next = await fetchAdminJson<AdminUsersData>(requestUrl);
        if (isActive) {
          setData(next);
        }
      } catch (loadError) {
        console.error("Admin users page error:", loadError);
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

  const users = data?.users || [];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={t("admin.users.title", currentLocale)}
        description={t("admin.users.description", currentLocale)}
      />

      {error ? <AdminErrorState message={error} /> : null}

      {data ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <AdminStatCard
              label={t("admin.kpi.totalUsers", currentLocale)}
              value={data.summary.totalUsers}
            />
            <AdminStatCard
              label={t("admin.kpi.activeUsers", currentLocale)}
              value={data.summary.activeUsers}
            />
            <AdminStatCard
              label={t("admin.users.inactiveSummary", currentLocale)}
              value={data.summary.inactiveUsers}
            />
          </div>

          <AdminPanel>
            <AdminPanelHeading
              title={t("admin.users.title", currentLocale)}
              description={t("admin.users.summaryDescription", currentLocale)}
              actions={
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Select
                    value={query.status}
                    onValueChange={(value) =>
                      updateQuery({ status: value }, { resetPage: true })
                    }
                  >
                    <SelectTrigger className="w-full border-white/10 bg-slate-950/65 text-slate-100 focus:ring-cyan-400/70 focus:ring-offset-slate-900 sm:w-44">
                      <SelectValue placeholder={t("admin.users.status", currentLocale)} />
                    </SelectTrigger>
                    <SelectContent className="border-white/10 bg-slate-950 text-slate-100">
                      <SelectItem value="ALL">{t("admin.users.allStatuses", currentLocale)}</SelectItem>
                      <SelectItem value="ACTIVE">{t("admin.status.active", currentLocale)}</SelectItem>
                      <SelectItem value="INACTIVE">{t("admin.status.inactive", currentLocale)}</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={query.platformRole}
                    onValueChange={(value) =>
                      updateQuery({ platformRole: value }, { resetPage: true })
                    }
                  >
                    <SelectTrigger className="w-full border-white/10 bg-slate-950/65 text-slate-100 focus:ring-cyan-400/70 focus:ring-offset-slate-900 sm:w-52">
                      <SelectValue placeholder={t("admin.users.platformRole", currentLocale)} />
                    </SelectTrigger>
                    <SelectContent className="border-white/10 bg-slate-950 text-slate-100">
                      <SelectItem value="ALL">{t("admin.users.allRoles", currentLocale)}</SelectItem>
                      {Object.values(PlatformAdminRole).map((role) => (
                        <SelectItem key={role} value={role}>
                          {role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              }
            />

            {users.length === 0 ? (
              <AdminEmptyState
                title={t("admin.empty.title", currentLocale)}
                description={t("admin.users.emptyDescription", currentLocale)}
              />
            ) : (
              <>
                <Table className="text-slate-100">
                  <TableHeader className="bg-white/[0.03]">
                    <TableRow className="border-white/10 hover:bg-transparent">
                      <TableHead className="text-slate-400">{t("admin.users.email", currentLocale)}</TableHead>
                      <TableHead className="text-slate-400">{t("admin.users.name", currentLocale)}</TableHead>
                      <TableHead className="text-slate-400">{t("admin.users.platformRole", currentLocale)}</TableHead>
                      <TableHead className="text-slate-400">{t("admin.users.status", currentLocale)}</TableHead>
                      <TableHead className="text-slate-400">{t("admin.users.storeRoles", currentLocale)}</TableHead>
                      <TableHead className="text-slate-400">{t("admin.users.lastSignIn", currentLocale)}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((item) => (
                      <TableRow key={item.id} className="border-white/10 hover:bg-white/[0.03]">
                        <TableCell className="font-medium text-white">{item.email}</TableCell>
                        <TableCell>{item.name}</TableCell>
                        <TableCell>
                          {item.platformRole ? (
                            <AdminPill tone="cyan">{item.platformRole}</AdminPill>
                          ) : (
                            <span className="text-slate-500">
                              {t("admin.role.none", currentLocale)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <AdminPill tone={item.status === "ACTIVE" ? "emerald" : "slate"}>
                            {t(`admin.status.${item.status.toLowerCase()}`, currentLocale)}
                          </AdminPill>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 text-sm text-slate-300">
                            <p>{item.storeRoleCount}</p>
                            <p className="text-xs text-slate-500">
                              {t("admin.users.activeStoreRoles", currentLocale)} {item.activeStoreRoles}
                              {" / "}
                              {t("admin.users.inactiveStoreRoles", currentLocale)} {item.inactiveStoreRoles}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{formatAdminDateTime(item.lastSignInAt, currentLocale)}</TableCell>
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
        </>
      ) : null}
    </div>
  );
}
