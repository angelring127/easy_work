import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withPlatformAdminWriteAuth } from "@/lib/auth/middleware";
import { parseAdminStatus, updateAnomalyStatus } from "@/lib/admin/service";

const updateSchema = z.object({
  status: z.enum(["OPEN", "ACK", "RESOLVED"]),
  resolutionNote: z.string().max(2000).optional(),
  assignedTo: z.string().uuid().optional(),
});

async function handlePatchAnomaly(
  request: NextRequest,
  context: { user: any; params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request body",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const item = await updateAnomalyStatus(
      {
        id: params.id,
        status: parseAdminStatus(parsed.data.status),
        resolutionNote: parsed.data.resolutionNote,
        assignedTo: parsed.data.assignedTo,
      },
      context.user
    );

    return NextResponse.json({
      success: true,
      data: item,
    });
  } catch (error) {
    console.error("Admin anomaly patch API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update anomaly",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withPlatformAdminWriteAuth(async (req, context) =>
    handlePatchAnomaly(req, { ...context, params })
  )(request);
}
