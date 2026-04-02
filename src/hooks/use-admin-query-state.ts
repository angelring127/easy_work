"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  type AdminPeriodOption,
  getAdminExportResource,
  parsePositiveInt,
} from "@/lib/admin/client";

type QueryValue = string | number | null | undefined;
type QueryUpdates = Record<string, QueryValue>;

export function useAdminQueryState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const query = useMemo(
    () => ({
      period:
        (searchParams.get("period") as AdminPeriodOption | null) || "7d",
      from: searchParams.get("from") || "",
      to: searchParams.get("to") || "",
      q: searchParams.get("q") || "",
      page: parsePositiveInt(searchParams.get("page"), 1),
      status: searchParams.get("status") || "ALL",
      platformRole: searchParams.get("platformRole") || "ALL",
      severity: searchParams.get("severity") || "ALL",
      eventType: searchParams.get("eventType") || "ALL",
    }),
    [searchParams]
  );

  const updateQuery = useCallback(
    (
      updates: QueryUpdates,
      options?: { resetPage?: boolean; scroll?: boolean }
    ) => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === undefined || value === "") {
          params.delete(key);
        } else {
          params.set(key, String(value));
        }
      });

      if (options?.resetPage) {
        params.delete("page");
      }

      const nextQuery = params.toString();
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
        scroll: options?.scroll ?? false,
      });
    },
    [pathname, router, searchParams]
  );

  const setPage = useCallback(
    (page: number) => {
      updateQuery({ page }, { scroll: false });
    },
    [updateQuery]
  );

  const resetGlobalFilters = useCallback(() => {
    updateQuery(
      {
        period: "7d",
        from: null,
        to: null,
        q: null,
      },
      { resetPage: true }
    );
  }, [updateQuery]);

  return {
    pathname,
    searchParams,
    query,
    updateQuery,
    setPage,
    resetGlobalFilters,
    exportResource: getAdminExportResource(pathname),
  };
}
