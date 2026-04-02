import { NextRequest, NextResponse } from "next/server";
import { withPlatformAdminAuth } from "@/lib/auth/middleware";
import {
  getAdminExportData,
  logPlatformAudit,
  normalizeRangeQuery,
} from "@/lib/admin/service";
import { buildCsv } from "@/lib/admin/utils";

const SUPPORTED_RESOURCES = new Set([
  "overview",
  "users",
  "stores",
  "anomalies",
  "audit-logs",
]);

async function handleExport(
  request: NextRequest,
  context: { user: any }
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const resource = searchParams.get("resource") || "overview";
    if (!SUPPORTED_RESOURCES.has(resource)) {
      return NextResponse.json(
        {
          success: false,
          error: "Unsupported export resource",
        },
        { status: 400 }
      );
    }

    const period = searchParams.get("period");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const range = normalizeRangeQuery(period, from, to);

    const data = await getAdminExportData(resource, range.from, range.to);
    const csv = buildCsv(data.headers, data.rows);

    await logPlatformAudit({
      actor: context.user,
      action: "EXPORT",
      eventType: "ADMIN_REPORT_EXPORTED",
      targetType: "report",
      targetId: resource,
      severity: "LOW",
      payload: {
        resource,
        from: range.from,
        to: range.to,
      },
    });

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=admin-${resource}-${range.from}-${range.to}.csv`,
      },
    });
  } catch (error) {
    console.error("Admin export API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to export report",
      },
      { status: 500 }
    );
  }
}

export const GET = withPlatformAdminAuth(handleExport);
