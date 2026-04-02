"use client";

import { useEffect, useState } from "react";
import { Download, RotateCcw, Search } from "lucide-react";
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
  ADMIN_PERIOD_OPTIONS,
  type AdminPeriodOption,
} from "@/lib/admin/client";
import { useAdminQueryState } from "@/hooks/use-admin-query-state";
import { t, type Locale } from "@/lib/i18n";
import { defaultLocale } from "@/lib/i18n-config";

export function AdminFilterBar() {
  const params = useParams();
  const currentLocale = (params.locale as Locale) || defaultLocale;
  const { searchParams, query, updateQuery, resetGlobalFilters, exportResource } =
    useAdminQueryState();
  const [searchValue, setSearchValue] = useState(query.q);

  useEffect(() => {
    setSearchValue(query.q);
  }, [query.q]);

  const handleExport = () => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("resource", exportResource);
    window.open(`/api/admin/export?${next.toString()}`, "_blank", "noopener,noreferrer");
  };

  return (
    <form
      className="rounded-3xl border border-white/10 bg-slate-900/72 p-5 shadow-[0_24px_90px_-55px_rgba(34,211,238,0.35)] backdrop-blur"
      onSubmit={(event) => {
        event.preventDefault();
        updateQuery({ q: searchValue || null }, { resetPage: true });
      }}
    >
      <div className="grid gap-3 xl:grid-cols-[180px_1fr_170px_170px_auto_auto]">
        <Select
          value={query.period}
          onValueChange={(value) =>
            updateQuery(
              {
                period: value as AdminPeriodOption,
                from: null,
                to: null,
              },
              { resetPage: true }
            )
          }
        >
          <SelectTrigger className="border-white/10 bg-slate-950/65 text-slate-100 focus:ring-cyan-400/70 focus:ring-offset-slate-900">
            <SelectValue placeholder={t("admin.period", currentLocale)} />
          </SelectTrigger>
          <SelectContent className="border-white/10 bg-slate-950 text-slate-100">
            {ADMIN_PERIOD_OPTIONS.map((period) => (
              <SelectItem
                key={period}
                value={period}
                className="focus:bg-cyan-400/15 focus:text-cyan-100"
              >
                {t(`admin.period.${period}`, currentLocale)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder={t("admin.searchPlaceholder", currentLocale)}
            className="border-white/10 bg-slate-950/65 pl-10 text-white placeholder:text-slate-500 focus-visible:ring-cyan-400/70 focus-visible:ring-offset-slate-900"
          />
        </div>

        <Input
          value={query.from}
          type="date"
          onChange={(event) =>
            updateQuery({ from: event.target.value || null }, { resetPage: true })
          }
          aria-label={t("admin.period.from", currentLocale)}
          className="border-white/10 bg-slate-950/65 text-slate-100 focus-visible:ring-cyan-400/70 focus-visible:ring-offset-slate-900"
        />

        <Input
          value={query.to}
          type="date"
          onChange={(event) =>
            updateQuery({ to: event.target.value || null }, { resetPage: true })
          }
          aria-label={t("admin.period.to", currentLocale)}
          className="border-white/10 bg-slate-950/65 text-slate-100 focus-visible:ring-cyan-400/70 focus-visible:ring-offset-slate-900"
        />

        <Button
          type="submit"
          className="bg-cyan-400 text-slate-950 hover:bg-cyan-300"
        >
          {t("admin.filters.apply", currentLocale)}
        </Button>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-white/10 bg-slate-950/55 text-slate-200 hover:bg-slate-800 hover:text-white"
            onClick={resetGlobalFilters}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            {t("admin.filters.reset", currentLocale)}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-white/10 bg-slate-950/55 text-slate-200 hover:bg-slate-800 hover:text-white"
            onClick={handleExport}
          >
            <Download className="mr-2 h-4 w-4" />
            {t("admin.exportCurrent", currentLocale)}
          </Button>
        </div>
      </div>
    </form>
  );
}
