import { NextRequest } from "next/server";
import { format, parseISO, subDays } from "date-fns";

const DATE_FMT = "yyyy-MM-dd";

export interface DateRange {
  from: string;
  to: string;
}

export function parseDateRange(request: NextRequest): DateRange {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") || "7d";
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (from && to) {
    return normalizeDateRange({ from, to });
  }

  const today = new Date();
  const days = period === "30d" ? 30 : period === "today" ? 0 : 7;
  const fromDate = subDays(today, days);

  return {
    from: format(fromDate, DATE_FMT),
    to: format(today, DATE_FMT),
  };
}

export function normalizeDateRange(range: DateRange): DateRange {
  const fromDate = parseISO(range.from);
  const toDate = parseISO(range.to);

  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    throw new Error("INVALID_DATE_RANGE");
  }

  if (fromDate > toDate) {
    return {
      from: format(toDate, DATE_FMT),
      to: format(fromDate, DATE_FMT),
    };
  }

  return {
    from: format(fromDate, DATE_FMT),
    to: format(toDate, DATE_FMT),
  };
}

export function parsePageInfo(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const pageRaw = Number(searchParams.get("page") || 1);
  const limitRaw = Number(searchParams.get("limit") || 20);

  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(limitRaw, 1), 100)
    : 20;
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

export function buildCsv(headers: string[], rows: Array<Array<string | number>>) {
  const escape = (value: string | number): string => {
    const text = String(value ?? "");
    const escaped = text.replace(/"/g, '""');
    return `"${escaped}"`;
  };

  const headerLine = headers.map(escape).join(",");
  const dataLines = rows.map((row) => row.map(escape).join(","));

  return [headerLine, ...dataLines].join("\n");
}

export function toIsoDay(value: string | Date): string {
  if (value instanceof Date) {
    return format(value, DATE_FMT);
  }

  return format(parseISO(value), DATE_FMT);
}
