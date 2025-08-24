import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/auth/middleware";
import { createClient } from "@/lib/supabase/server";

// 매장 생성 스키마
const createStoreSchema = z.object({
  name: z
    .string()
    .min(1, "매장명은 필수입니다")
    .max(255, "매장명은 255자 이하여야 합니다"),
  description: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  timezone: z.string().default("Asia/Seoul"),
});

type CreateStoreRequest = z.infer<typeof createStoreSchema>;

/**
 * 매장 생성 API
 * POST /api/stores
 * 마스터만 매장을 생성할 수 있습니다.
 */
async function createStore(
  request: NextRequest,
  context: { user: any }
): Promise<NextResponse> {
  try {
    const { user } = context;
    const supabase = await createClient();

    // CREATE_STORE 권한 확인
    if (user.role !== "MASTER") {
      return NextResponse.json(
        {
          success: false,
          error: "매장 생성 권한이 없습니다",
        },
        { status: 403 }
      );
    }

    // 요청 데이터 검증
    const body = await request.json();
    const validatedData = createStoreSchema.parse(body);

    // 매장 생성
    const { data: store, error: storeError } = await supabase
      .from("stores")
      .insert({
        ...validatedData,
        owner_id: user.id,
        status: "ACTIVE",
      })
      .select("*")
      .single();

    if (storeError) {
      console.error("매장 생성 오류:", storeError);
      return NextResponse.json(
        {
          success: false,
          error: "매장 생성에 실패했습니다",
        },
        { status: 500 }
      );
    }

    // 사용자 역할 정보 추가
    const storeWithRole = {
      ...store,
      user_role: "MASTER",
      granted_at: store.created_at,
    };

    return NextResponse.json({
      success: true,
      data: storeWithRole,
      message: "매장이 성공적으로 생성되었습니다",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "입력 데이터가 올바르지 않습니다",
          details: error.errors,
        },
        { status: 400 }
      );
    }

    console.error("매장 생성 API 오류:", error);
    return NextResponse.json(
      {
        success: false,
        error: "서버 오류가 발생했습니다",
      },
      { status: 500 }
    );
  }
}

/**
 * 매장 목록 조회 API
 * GET /api/stores?mine=1
 * 사용자가 접근 가능한 매장 목록을 반환합니다.
 */
async function getStores(
  request: NextRequest,
  context: { user: any }
): Promise<NextResponse> {
  try {
    const { user } = context;
    const { searchParams } = new URL(request.url);
    const mine = searchParams.get("mine") === "1";

    const supabase = await createClient();

    if (mine) {
      // 사용자가 소유한 매장만 조회 (단순화)
      const { data: stores, error: storesError } = await supabase
        .from("stores")
        .select("*")
        .eq("status", "ACTIVE")
        .eq("owner_id", user.id)
        .order("name", { ascending: true });

      if (storesError) {
        console.error("매장 목록 조회 오류:", storesError);
        return NextResponse.json(
          {
            success: false,
            error: "매장 목록 조회에 실패했습니다",
          },
          { status: 500 }
        );
      }

      // 사용자 역할 정보 추가
      const storesWithRole = (stores || []).map((store) => ({
        ...store,
        user_role: "MASTER",
        granted_at: store.created_at,
      }));

      return NextResponse.json({
        success: true,
        data: storesWithRole,
      });
    } else {
      // 모든 ACTIVE 매장 조회 (관리자용)
      if (user.role !== "MASTER") {
        return NextResponse.json(
          {
            success: false,
            error: "전체 매장 목록 조회 권한이 없습니다",
          },
          { status: 403 }
        );
      }

      const { data: stores, error: storesError } = await supabase
        .from("stores")
        .select("*")
        .eq("status", "ACTIVE")
        .order("name", { ascending: true });

      if (storesError) {
        console.error("전체 매장 목록 조회 오류:", storesError);
        return NextResponse.json(
          {
            success: false,
            error: "매장 목록 조회에 실패했습니다",
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: stores || [],
      });
    }
  } catch (error) {
    console.error("매장 목록 조회 API 오류:", error);
    return NextResponse.json(
      {
        success: false,
        error: "서버 오류가 발생했습니다",
      },
      { status: 500 }
    );
  }
}

// 인증 미들웨어로 래핑
export const POST = withAuth(createStore);
export const GET = withAuth(getStores);
