import { NextRequest, NextResponse } from "next/server";
import { withPlatformAdminAuth } from "@/lib/auth/middleware";
import { getAdminAnomalies, normalizeRangeQuery } from "@/lib/admin/service";

async function handleGetAnomalies(
  request: NextRequest,
  context: { user: any }
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const page = Number(searchParams.get("page") || 1);
    const limit = Number(searchParams.get("limit") || 20);
    const q = searchParams.get("q") || "";
    const status = searchParams.get("status") || "ALL";
    const severity = searchParams.get("severity") || "ALL";

    const range = normalizeRangeQuery(period, from, to);

    const data = await getAdminAnomalies({
      from: range.from,
      to: range.to,
      page,
      limit,
      q,
      status,
      severity,
    });

    return NextResponse.json({
      success: true,
      data,
      requestedBy: {
        id: context.user.id,
        platformRole: context.user.platform_admin_role || null,
      },
      period: range,
    });
  } catch (error) {
    console.error("Admin anomalies API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch anomalies",
      },
      { status: 500 }
    );
  }
}

export const GET = withPlatformAdminAuth(handleGetAnomalies);
