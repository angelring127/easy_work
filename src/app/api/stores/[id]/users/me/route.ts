import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: storeId } = await params;
    const supabase = await createClient();

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    const { data: storeUser, error } = await supabase
      .from("store_users")
      .select(
        `
        id,
        user_id,
        store_id,
        name,
        email,
        status,
        created_at,
        updated_at,
        deleted_at,
        user_store_roles!inner (
          role
        )
      `
      )
      .eq("store_id", storeId)
      .eq("user_id", userId)
      .eq("status", "ACTIVE")
      .is("deleted_at", null)
      .single();

    if (error || !storeUser) {
      return NextResponse.json(
        { error: "User not found in this store" },
        { status: 404 }
      );
    }

    const role = (storeUser.user_store_roles as any)?.[0]?.role || null;

    return NextResponse.json({
      success: true,
      data: {
        id: storeUser.id,
        user_id: storeUser.user_id,
        name: storeUser.name,
        email: storeUser.email,
        role: role,
        status: storeUser.status,
      },
    });
  } catch (error) {
    console.error("Error fetching current user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
