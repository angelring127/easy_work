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
      // RLS 우회 함수를 사용하여 사용자가 접근 가능한 매장 조회
      let { data: stores, error: storesError } = await supabase.rpc(
        "get_user_accessible_stores",
        { p_user_id: user.id }
      );

      console.log("매장 목록 조회 - RLS 우회 함수 결과:", {
        userId: user.id,
        stores,
        storesError,
        storesCount: stores?.length || 0,
      });

      // 함수가 없는 경우 대안 로직 사용
      if (
        storesError &&
        storesError.message.includes("Could not find the function")
      ) {
        console.log("RLS 우회 함수가 없어서 대안 로직 사용");

        // 직접 쿼리로 매장 조회 (소유한 매장 + 초대된 매장)
        const { data: ownedStores } = await supabase
          .from("stores")
          .select("*")
          .eq("status", "ACTIVE")
          .eq("owner_id", user.id);

        // user_store_roles에서 조회
        const { data: userRoles, error: userRolesError } = await supabase
          .from("user_store_roles")
          .select("store_id, role, granted_at")
          .eq("user_id", user.id)
          .eq("status", "ACTIVE");

        console.log("매장 목록 조회 - user_store_roles:", {
          userId: user.id,
          userRoles,
          userRolesError,
        });

        // store_users에서도 조회 (일반 유저의 경우)
        const { data: storeUsers, error: storeUsersError } = await supabase
          .from("store_users")
          .select("store_id, role, granted_at")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .eq("is_guest", false);

        console.log("매장 목록 조회 - store_users:", {
          userId: user.id,
          storeUsers,
          storeUsersError,
        });

        // 모든 매장 ID 수집 (중복 제거)
        const storeIds = new Set<string>();
        (ownedStores || []).forEach((store) => storeIds.add(store.id));
        (userRoles || []).forEach((role) => storeIds.add(role.store_id));
        (storeUsers || []).forEach((su) => storeIds.add(su.store_id));

        console.log("매장 목록 조회 - 수집된 매장 ID:", {
          ownedStoresCount: ownedStores?.length || 0,
          userRolesCount: userRoles?.length || 0,
          storeUsersCount: storeUsers?.length || 0,
          totalStoreIds: Array.from(storeIds),
        });

        // 매장 정보 조회
        const { data: allStoresData, error: allStoresError } = await supabase
          .from("stores")
          .select("*")
          .eq("status", "ACTIVE")
          .in("id", Array.from(storeIds));

        console.log("매장 목록 조회 - 매장 정보:", {
          allStoresData,
          allStoresError,
        });

        // 매장 목록 생성 (역할 정보 포함)
        const allStores = (allStoresData || []).map((store) => {
          // 소유한 매장인 경우
          if (store.owner_id === user.id) {
            return {
              ...store,
              user_role: "MASTER",
              granted_at: store.created_at,
            };
          }

          // user_store_roles에서 역할 찾기
          const userRole = userRoles?.find((r) => r.store_id === store.id);
          if (userRole) {
            return {
              ...store,
              user_role: userRole.role,
              granted_at: userRole.granted_at,
            };
          }

          // store_users에서 역할 찾기
          const storeUser = storeUsers?.find((su) => su.store_id === store.id);
          if (storeUser) {
            return {
              ...store,
              user_role: storeUser.role,
              granted_at: storeUser.granted_at,
            };
          }

          // 기본값
          return {
            ...store,
            user_role: "PART_TIMER",
            granted_at: store.created_at,
          };
        });

        stores = allStores.sort((a, b) => a.name.localeCompare(b.name));
        storesError = null;
      }

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

      console.log("매장 목록 조회 결과:", {
        userId: user.id,
        userEmail: user.email,
        storesCount: stores?.length || 0,
        stores: stores?.map((s) => ({
          id: s.id,
          name: s.name,
          owner_id: s.owner_id,
          user_role: s.user_role,
          isOwner: s.owner_id === user.id,
        })),
        usedFallback:
          storesError?.message?.includes("Could not find the function") ||
          false,
      });

      // RLS 우회 함수가 이미 역할 정보를 포함하므로 그대로 사용
      const storesWithRole = stores || [];

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
