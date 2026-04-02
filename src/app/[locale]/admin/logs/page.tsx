"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import type { AdminAuditLogsData } from "@/types/admin";

function getSeverityTone(severity: string) {
  const normalized = severity.toUpperCase();
  if (normalized === "HIGH") {
    return "rose";
  }

  if (normalized === "MEDIUM") {
    return "amber";
  }

  return "slate";
}

export default function AdminLogsPage() {
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
    if (query.severity !== "ALL") {
      searchParams.set("severity", query.severity);
    }
    if (query.eventType !== "ALL") {
      searchParams.set("eventType", query.eventType);
    }

    return `/api/admin/audit-logs?${searchParams.toString()}`;
  }, [query.eventType, query.from, query.page, query.period, query.q, query.severity, query.to]);

  const [data, setData] = useState<AdminAuditLogsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [eventTypeDraft, setEventTypeDraft] = useState(query.eventType === "ALL" ? "" : query.eventType);

  useEffect(() => {
    let isActive = true;

    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const next = await fetchAdminJson<AdminAuditLogsData>(requestUrl);
        if (isActive) {
          setData(next);
        }
      } catch (loadError) {
        console.error("Admin logs page error:", loadError);
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

  useEffect(() => {
    setEventTypeDraft(query.eventType === "ALL" ? "" : query.eventType);
  }, [query.eventType]);

  if (loading && !data) {
    return <AdminLoadingState locale={currentLocale} />;
  }

  const logs = data?.logs || [];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={t("admin.logs.title", currentLocale)}
        description={t("admin.logs.description", currentLocale)}
      />

      {error ? <AdminErrorState message={error} /> : null}

      {data ? (
        <AdminPanel>
          <AdminPanelHeading
            title={t("admin.logs.title", currentLocale)}
            description={t("admin.logs.summaryDescription", currentLocale)}
            actions={
              <div className="flex flex-col gap-2 sm:flex-row">
                <Select
                  value={query.severity}
                  onValueChange={(value) =>
                    updateQuery({ severity: value }, { resetPage: true })
                  }
                >
                  <SelectTrigger className="w-full border-white/10 bg-slate-950/65 text-slate-100 focus:ring-cyan-400/70 focus:ring-offset-slate-900 sm:w-44">
                    <SelectValue placeholder={t("admin.logs.severity", currentLocale)} />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-slate-950 text-slate-100">
                    <SelectItem value="ALL">{t("admin.logs.allSeverities", currentLocale)}</SelectItem>
                    <SelectItem value="HIGH">{t("admin.severity.high", currentLocale)}</SelectItem>
                    <SelectItem value="MEDIUM">{t("admin.severity.medium", currentLocale)}</SelectItem>
                    <SelectItem value="LOW">{t("admin.severity.low", currentLocale)}</SelectItem>
                  </SelectContent>
                </Select>

                <form
                  className="flex gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    updateQuery(
                      { eventType: eventTypeDraft || null },
                      { resetPage: true }
                    );
                  }}
                >
                  <Input
                    value={eventTypeDraft}
                    onChange={(event) => setEventTypeDraft(event.target.value)}
                    placeholder={t("admin.logs.eventTypePlaceholder", currentLocale)}
                    className="border-white/10 bg-slate-950/65 text-slate-100 placeholder:text-slate-500 focus-visible:ring-cyan-400/70 focus-visible:ring-offset-slate-900 sm:w-56"
                  />
                  <Button
                    type="submit"
                    className="bg-cyan-400 text-slate-950 hover:bg-cyan-300"
                  >
                    {t("admin.filters.apply", currentLocale)}
                  </Button>
                </form>
              </div>
            }
          />

          {logs.length === 0 ? (
            <AdminEmptyState
              title={t("admin.empty.title", currentLocale)}
              description={t("admin.logs.emptyDescription", currentLocale)}
            />
          ) : (
            <>
              <Table className="text-slate-100">
                <TableHeader className="bg-white/[0.03]">
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-slate-400">{t("admin.logs.scope", currentLocale)}</TableHead>
                    <TableHead className="text-slate-400">{t("admin.logs.eventType", currentLocale)}</TableHead>
                    <TableHead className="text-slate-400">{t("admin.logs.actor", currentLocale)}</TableHead>
                    <TableHead className="text-slate-400">{t("admin.logs.severity", currentLocale)}</TableHead>
                    <TableHead className="text-slate-400">{t("admin.logs.createdAt", currentLocale)}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((item) => (
                    <TableRow key={item.id} className="border-white/10 hover:bg-white/[0.03]">
                      <TableCell>
                        <AdminPill tone="slate">
                          {t(`admin.logs.scope.${item.scope.toLowerCase()}`, currentLocale)}
                        </AdminPill>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium text-white">{item.eventType}</p>
                          <p className="text-xs text-slate-500">{item.action}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p>{item.actorEmail || "-"}</p>
                          <p className="text-xs text-slate-500">{item.actorRole || "-"}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <AdminPill tone={getSeverityTone(item.severity)}>
                          {t(`admin.severity.${item.severity.toLowerCase()}`, currentLocale)}
                        </AdminPill>
                      </TableCell>
                      <TableCell>{formatAdminDateTime(item.createdAt, currentLocale)}</TableCell>
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
