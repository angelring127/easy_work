import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function AdminPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-white/10 pb-5 md:flex-row md:items-end md:justify-between">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-white">
          {title}
        </h1>
        {description ? (
          <p className="max-w-3xl text-sm leading-6 text-slate-300">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
    </div>
  );
}

export function AdminPanel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-3xl border border-white/10 bg-slate-900/72 p-6 shadow-[0_30px_90px_-50px_rgba(34,211,238,0.35)] backdrop-blur",
        className
      )}
    >
      {children}
    </section>
  );
}

export function AdminPanelHeading({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {description ? (
          <p className="text-sm leading-6 text-slate-400">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function AdminStatCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string | number;
  helper?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-5">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
      {helper ? <p className="mt-2 text-sm text-slate-400">{helper}</p> : null}
    </div>
  );
}

export function AdminPill({
  tone = "slate",
  className,
  children,
}: {
  tone?: "slate" | "cyan" | "emerald" | "amber" | "rose";
  className?: string;
  children: React.ReactNode;
}) {
  const toneClassName = {
    slate: "border-white/10 bg-white/5 text-slate-200",
    cyan: "border-cyan-400/30 bg-cyan-400/10 text-cyan-100",
    emerald: "border-emerald-400/30 bg-emerald-400/10 text-emerald-100",
    amber: "border-amber-400/30 bg-amber-400/10 text-amber-100",
    rose: "border-rose-400/30 bg-rose-400/10 text-rose-100",
  }[tone];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium",
        toneClassName,
        className
      )}
    >
      {children}
    </span>
  );
}

export function AdminEmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-slate-950/30 px-6 py-10 text-center">
      <p className="text-base font-medium text-slate-200">{title}</p>
      {description ? (
        <p className="mt-2 text-sm text-slate-400">{description}</p>
      ) : null}
    </div>
  );
}

export function AdminLoadingState({ locale }: { locale: Locale }) {
  return (
    <div className="flex min-h-[280px] items-center justify-center rounded-3xl border border-white/10 bg-slate-900/72">
      <div className="flex items-center gap-3 text-slate-200">
        <Loader2 className="h-5 w-5 animate-spin text-cyan-300" />
        <span>{t("auth.login.loading", locale)}</span>
      </div>
    </div>
  );
}

export function AdminErrorState({
  message,
}: {
  message: string;
}) {
  return (
    <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 px-5 py-4 text-sm text-rose-100">
      {message}
    </div>
  );
}

export function AdminPagination({
  locale,
  page,
  totalPages,
  onPrev,
  onNext,
}: {
  locale: Locale;
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="mt-5 flex items-center justify-end gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="border-white/10 bg-slate-950/55 text-slate-200 hover:bg-slate-800 hover:text-white"
        disabled={page <= 1}
        onClick={onPrev}
      >
        {t("admin.pagination.prev", locale)}
      </Button>
      <span className="min-w-20 text-center text-sm text-slate-400">
        {page} / {totalPages}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="border-white/10 bg-slate-950/55 text-slate-200 hover:bg-slate-800 hover:text-white"
        disabled={page >= totalPages}
        onClick={onNext}
      >
        {t("admin.pagination.next", locale)}
      </Button>
    </div>
  );
}
