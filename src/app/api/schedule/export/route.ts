import { NextRequest, NextResponse } from "next/server";
import { createClient, createPureClient } from "@/lib/supabase/server";
import { z } from "zod";
import * as XLSX from "xlsx";

// 엑셀 내보내기 스키마
const ExportSchema = z.object({
  store_id: z.string().uuid(),
  from: z.string(), // ISO date
  to: z.string(), // ISO date
  format: z.enum(["xlsx", "csv"]).default("xlsx"),
  scope: z.enum(["all", "me"]).default("all"),
  include_private_info: z.boolean().default(false),
});

/**
 * 스케줄 엑셀 내보내기
 * GET /api/schedule/export
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const { searchParams } = new URL(request.url);
  const queryParams = {
    store_id: searchParams.get("store_id"),
    from: searchParams.get("from"),
    to: searchParams.get("to"),
    format: searchParams.get("format") || "xlsx",
    scope: searchParams.get("scope") || "all",
    include_private_info: searchParams.get("include_private_info") === "true",
  };

  const parsed = ExportSchema.safeParse(queryParams);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { data: user, error: authError } = await supabase.auth.getUser();
  if (authError || !user.user) {
    return NextResponse.json(
      { success: false, error: "unauthorized" },
      { status: 401 }
    );
  }

  const { store_id, from, to, format, scope, include_private_info } =
    parsed.data;

  try {
    // 권한 확인
    const { data: userRole, error: roleError } = await supabase
      .from("user_store_roles")
      .select("role")
      .eq("store_id", store_id)
      .eq("user_id", user.user.id)
      .eq("status", "ACTIVE")
      .single();

    if (roleError || !userRole) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    // scope가 "me"이고 관리자가 아닌 경우 본인 데이터만
    const isManager = ["MASTER", "SUB", "SUB_MANAGER"].includes(userRole.role);
    const userIdFilter =
      scope === "me" && !isManager ? user.user.id : undefined;

    // 스케줄 배정 데이터 조회
    const { data: assignments, error: assignmentsError } = await supabase
      .from("schedule_assignments")
      .select(
        `
        *,
        work_items!inner(
          id,
          name,
          start_min,
          end_min,
          role_hint
        )
      `
      )
      .eq("store_id", store_id)
      .gte("date", from)
      .lte("date", to)
      .eq("status", "ASSIGNED")
      .order("date", { ascending: true })
      .order("start_time", { ascending: true });

    if (assignmentsError) {
      console.error("스케줄 배정 조회 오류:", assignmentsError);
      return NextResponse.json(
        { success: false, error: assignmentsError.message },
        { status: 500 }
      );
    }

    // 사용자 정보 조회 (간단한 방법)
    const userIds = [...new Set(assignments?.map((a) => a.user_id) || [])];
    const userMap = new Map();

    // Admin API 사용을 위해 Service Role Key 클라이언트 사용
    const adminClient = await createPureClient();

    // 각 사용자에 대해 개별적으로 정보 조회
    for (const userId of userIds) {
      const { data: userData, error: userError } =
        await adminClient.auth.admin.getUserById(userId);
      if (!userError && userData.user) {
        userMap.set(userId, userData.user);
      }
    }

    // 사용자 필터 적용
    const filteredAssignments = userIdFilter
      ? assignments?.filter((a) => a.user_id === userIdFilter) || []
      : assignments || [];

    // 매장 정보 조회
    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("name, timezone")
      .eq("id", store_id)
      .single();

    if (storeError) {
      console.error("매장 정보 조회 오류:", storeError);
      return NextResponse.json(
        { success: false, error: storeError.message },
        { status: 500 }
      );
    }

    // 역할 정보 조회
    const { data: roles, error: rolesError } = await supabase
      .from("store_job_roles")
      .select("*")
      .eq("store_id", store_id)
      .eq("active", true)
      .order("name");

    if (rolesError) {
      console.error("역할 정보 조회 오류:", rolesError);
      return NextResponse.json(
        { success: false, error: rolesError.message },
        { status: 500 }
      );
    }

    // 사용자-역할 매핑 조회
    const { data: userRoles, error: userRolesError } = await supabase
      .from("user_store_job_roles")
      .select(
        `
        id,
        user_id,
        job_role_id,
        store_job_roles!inner(
          id,
          name
        )
      `
      )
      .eq("store_id", store_id);

    if (userRolesError) {
      console.error("사용자-역할 매핑 조회 오류:", userRolesError);
      return NextResponse.json(
        { success: false, error: userRolesError.message },
        { status: 500 }
      );
    }

    // 사용자 표시명 조회 (store_users 기반)
    const { data: storeUsers, error: storeUsersError } = await supabase
      .from("store_users")
      .select("id, user_id, name, email")
      .eq("store_id", store_id);

    if (storeUsersError) {
      console.error("내보내기용 사용자 조회 오류:", storeUsersError);
      return NextResponse.json(
        { success: false, error: storeUsersError.message },
        { status: 500 }
      );
    }

    const storeUserById = new Map(
      (storeUsers || []).map((u) => [u.id, u] as const)
    );
    const storeUserByAuthId = new Map(
      (storeUsers || [])
        .filter((u) => Boolean(u.user_id))
        .map((u) => [u.user_id as string, u] as const)
    );

    const normalizedUserRoles = (userRoles || []).map((ur) => {
      const mappedUser =
        storeUserById.get(ur.user_id) || storeUserByAuthId.get(ur.user_id);
      return {
        ...ur,
        user_name: mappedUser?.name || mappedUser?.email || ur.user_id,
        user_email: mappedUser?.email || "",
      };
    });

    // 엑셀 워크북 생성
    const workbook = XLSX.utils.book_new();

    // 1. Week Grid 시트
    const weekGridData = generateWeekGridData(
      filteredAssignments,
      userMap,
      include_private_info
    );
    const weekGridSheet = XLSX.utils.aoa_to_sheet(weekGridData);
    XLSX.utils.book_append_sheet(workbook, weekGridSheet, "Week Grid");

    // 2. Assignments 시트
    const assignmentsData = generateAssignmentsData(
      filteredAssignments,
      userMap,
      include_private_info
    );
    const assignmentsSheet = XLSX.utils.aoa_to_sheet(assignmentsData);
    XLSX.utils.book_append_sheet(workbook, assignmentsSheet, "Assignments");

    // 3. Roles 시트
    const rolesData = generateRolesData(
      roles,
      normalizedUserRoles,
      include_private_info
    );
    const rolesSheet = XLSX.utils.aoa_to_sheet(rolesData);
    XLSX.utils.book_append_sheet(workbook, rolesSheet, "Roles");

    // 파일 생성
    const fileName = `workeasy_${store.name.replace(
      /\s+/g,
      "_"
    )}_${from}_to_${to}.${format}`;

    if (format === "xlsx") {
      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
      return new NextResponse(buffer, {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${fileName}"`,
        },
      });
    } else {
      // CSV는 첫 번째 시트만
      const csv = XLSX.utils.sheet_to_csv(weekGridSheet);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${fileName}"`,
        },
      });
    }
  } catch (error) {
    console.error("엑셀 내보내기 중 오류:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Week Grid 데이터 생성
function generateWeekGridData(
  assignments: any[],
  userMap: Map<string, any>,
  includePrivateInfo: boolean
): any[][] {
  const data: any[][] = [];

  // 헤더 행
  const headerRow = ["User"];
  const dates = [...new Set(assignments.map((a) => a.date))].sort();
  dates.forEach((date) => {
    headerRow.push(new Date(date).toLocaleDateString());
  });
  data.push(headerRow);

  // 사용자별 데이터
  const users = [...new Set(assignments.map((a) => a.user_id))];
  users.forEach((userId) => {
    const userAssignments = assignments.filter((a) => a.user_id === userId);
    const userInfo = userMap.get(userId);
    const userName =
      userInfo?.raw_user_meta_data?.name || userInfo?.email || "Unknown User";

    const userRow = [userName];
    dates.forEach((date) => {
      const dayAssignments = userAssignments.filter((a) => a.date === date);
      if (dayAssignments.length > 0) {
        const workItems = dayAssignments
          .map((a) => a.work_items.name)
          .join("\n");
        userRow.push(workItems);
      } else {
        userRow.push("");
      }
    });
    data.push(userRow);
  });

  return data;
}

// Assignments 데이터 생성
function generateAssignmentsData(
  assignments: any[],
  userMap: Map<string, any>,
  includePrivateInfo: boolean
): any[][] {
  const data: any[][] = [];

  // 헤더 행
  const headerRow = [
    "Date",
    "Day",
    "User",
    "Work Item",
    "Start Time",
    "End Time",
    "Required Roles",
    "Notes",
  ];

  if (includePrivateInfo) {
    headerRow.splice(3, 0, "Email");
  }

  data.push(headerRow);

  // 데이터 행
  assignments.forEach((assignment) => {
    const userInfo = userMap.get(assignment.user_id);
    const row = [
      assignment.date,
      new Date(assignment.date).toLocaleDateString("en-US", {
        weekday: "long",
      }),
      userInfo?.raw_user_meta_data?.name || userInfo?.email || "Unknown",
      assignment.work_items?.name || "",
      assignment.start_time,
      assignment.end_time,
      assignment.work_items?.role_hint || "",
      assignment.notes || "",
    ];

    if (includePrivateInfo) {
      row.splice(3, 0, userInfo?.email || "");
    }

    data.push(row);
  });

  return data;
}

// Roles 데이터 생성
function generateRolesData(
  roles: any[],
  userRoles: any[],
  includePrivateInfo: boolean
): any[][] {
  const data: any[][] = [];

  // 역할 마스터 섹션
  data.push(["Role Master"]);
  data.push(["Role", "Active", "User Count"]);

  roles.forEach((role) => {
    const userCount = userRoles.filter((ur) => ur.job_role_id === role.id).length;
    data.push([role.name, role.active ? "Yes" : "No", userCount]);
  });

  // 빈 행
  data.push([]);
  data.push([]);

  // 사용자-역할 매핑 섹션
  data.push(["User-Role Mapping"]);
  const headerRow = ["User"];
  if (includePrivateInfo) {
    headerRow.push("Email");
  }
  headerRow.push("Roles");
  data.push(headerRow);

  // 사용자별 역할 그룹화
  const userRoleMap = new Map();
  userRoles.forEach((ur) => {
    const userId = ur.user_id;
    const userName = ur.user_name || "Unknown";
    const roleName = ur.store_job_roles?.name || "Unknown";

    if (!userRoleMap.has(userId)) {
      userRoleMap.set(userId, {
        name: userName,
        email: ur.user_email || "",
        roles: [],
      });
    }
    userRoleMap.get(userId).roles.push(roleName);
  });

  // 사용자별 데이터 행
  userRoleMap.forEach((userData, userId) => {
    const row = [userData.name];
    if (includePrivateInfo) {
      row.push(userData.email);
    }
    row.push(userData.roles.join(", "));
    data.push(row);
  });

  return data;
}
