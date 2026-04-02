import { NextRequest, NextResponse } from "next/server";
import { withPlatformAdminAuth } from "@/lib/auth/middleware";
import { getAdminOverview, normalizeRangeQuery } from "@/lib/admin/service";

async function handleGetOverview(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const range = normalizeRangeQuery(period, from, to);

    const data = await getAdminOverview(range.from, range.to);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Admin overview API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch admin overview",
      },
      { status: 500 }
    );
  }
}

export const GET = withPlatformAdminAuth(handleGetOverview);
