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
} from "@/components/admin/admin-ui";
import { useAdminQueryState } from "@/hooks/use-admin-query-state";
import { fetchAdminJson, formatAdminDateTime } from "@/lib/admin/client";
import { defaultLocale } from "@/lib/i18n-config";
import { t, type Locale } from "@/lib/i18n";
import type { AdminStoreItem, AdminStoresData } from "@/types/admin";

function getRiskTone(risk: AdminStoreItem["riskLevel"]) {
  if (risk === "HIGH") {
    return "rose";
  }

  if (risk === "MEDIUM") {
    return "amber";
  }

  return "emerald";
}

export default function AdminStoresPage() {
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

    return `/api/admin/stores?${searchParams.toString()}`;
  }, [query.from, query.page, query.period, query.q, query.status, query.to]);

  const [data, setData] = useState<AdminStoresData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isActive = true;

    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const next = await fetchAdminJson<AdminStoresData>(requestUrl);
        if (isActive) {
          setData(next);
        }
      } catch (loadError) {
        console.error("Admin stores page error:", loadError);
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

  const stores = data?.stores || [];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={t("admin.stores.title", currentLocale)}
        description={t("admin.stores.description", currentLocale)}
      />

      {error ? <AdminErrorState message={error} /> : null}

      {data ? (
        <AdminPanel>
          <AdminPanelHeading
            title={t("admin.stores.title", currentLocale)}
            description={t("admin.stores.summaryDescription", currentLocale)}
            actions={
              <Select
                value={query.status}
                onValueChange={(value) =>
                  updateQuery({ status: value }, { resetPage: true })
                }
              >
                <SelectTrigger className="w-full border-white/10 bg-slate-950/65 text-slate-100 focus:ring-cyan-400/70 focus:ring-offset-slate-900 sm:w-44">
                  <SelectValue placeholder={t("admin.stores.status", currentLocale)} />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-slate-950 text-slate-100">
                  <SelectItem value="ALL">{t("admin.stores.allStatuses", currentLocale)}</SelectItem>
                  <SelectItem value="ACTIVE">{t("admin.status.active", currentLocale)}</SelectItem>
                  <SelectItem value="ARCHIVED">{t("admin.status.archived", currentLocale)}</SelectItem>
                </SelectContent>
              </Select>
            }
          />

          {stores.length === 0 ? (
            <AdminEmptyState
              title={t("admin.empty.title", currentLocale)}
              description={t("admin.stores.emptyDescription", currentLocale)}
            />
          ) : (
            <>
              <Table className="text-slate-100">
                <TableHeader className="bg-white/[0.03]">
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-slate-400">{t("admin.stores.name", currentLocale)}</TableHead>
                    <TableHead className="text-slate-400">{t("admin.stores.status", currentLocale)}</TableHead>
                    <TableHead className="text-slate-400">{t("admin.stores.owner", currentLocale)}</TableHead>
                    <TableHead className="text-slate-400">{t("admin.stores.members", currentLocale)}</TableHead>
                    <TableHead className="text-slate-400">{t("admin.stores.pendingInvitations", currentLocale)}</TableHead>
                    <TableHead className="text-slate-400">{t("admin.stores.assignments30d", currentLocale)}</TableHead>
                    <TableHead className="text-slate-400">{t("admin.stores.risk", currentLocale)}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stores.map((item) => (
                    <TableRow key={item.id} className="border-white/10 hover:bg-white/[0.03]">
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium text-white">{item.name}</p>
                          <p className="text-xs text-slate-500">
                            {formatAdminDateTime(item.createdAt, currentLocale)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <AdminPill tone={item.status === "ACTIVE" ? "emerald" : "slate"}>
                          {t(`admin.status.${item.status.toLowerCase()}`, currentLocale)}
                        </AdminPill>
                      </TableCell>
                      <TableCell>{item.ownerEmail || "-"}</TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm text-slate-300">
                          <p>{item.memberCount}</p>
                          <p className="text-xs text-slate-500">
                            {t("admin.stores.managers", currentLocale)} {item.managerCount}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{item.pendingInvitations}</TableCell>
                      <TableCell>{item.assignmentCount30d}</TableCell>
                      <TableCell>
                        <AdminPill tone={getRiskTone(item.riskLevel)}>
                          {t(`admin.risk.${item.riskLevel.toLowerCase()}`, currentLocale)}
                        </AdminPill>
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
