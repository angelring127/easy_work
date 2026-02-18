import { createClient } from "@/lib/supabase/server";
import { defaultLocale, isValidLocale, type Locale } from "@/lib/i18n";

// 역할 커버리지 정보 타입
export interface RoleCoverage {
  jobRoleId: string;
  jobRoleName: string;
  jobRoleCode: string | null;
  requiredCount: number;
  currentCount: number;
  isSufficient: boolean;
}

// 근무 항목별 역할 요구 정보 타입
export interface WorkItemRoleRequirement {
  workItemId: string;
  jobRoleId: string;
  jobRoleName: string;
  jobRoleCode: string | null;
  minCount: number;
}

// 유저별 직무 역할 정보 타입
export interface UserJobRole {
  userId: string;
  jobRoleId: string;
  jobRoleName: string;
  jobRoleCode: string | null;
}

/**
 * 근무 항목의 역할 요구 사항을 조회합니다.
 */
export async function getWorkItemRoleRequirements(
  workItemIds: string[]
): Promise<WorkItemRoleRequirement[]> {
  if (workItemIds.length === 0) return [];

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("work_item_required_roles")
    .select(
      `
      work_item_id,
      min_count,
      store_job_roles (
        id,
        name,
        code
      )
    `
    )
    .in("work_item_id", workItemIds);

  if (error) {
    console.error("역할 요구 사항 조회 오류:", error);
    return [];
  }

  return (data || []).map((item) => ({
    workItemId: item.work_item_id,
    jobRoleId: item.store_job_roles?.[0]?.id,
    jobRoleName: item.store_job_roles?.[0]?.name,
    jobRoleCode: item.store_job_roles?.[0]?.code,
    minCount: item.min_count,
  }));
}

/**
 * 유저들의 직무 역할을 조회합니다.
 */
export async function getUserJobRoles(
  storeId: string,
  userIds: string[]
): Promise<UserJobRole[]> {
  if (userIds.length === 0) return [];

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("user_store_job_roles")
    .select(
      `
      user_id,
      store_job_roles (
        id,
        name,
        code
      )
    `
    )
    .eq("store_id", storeId)
    .in("user_id", userIds);

  if (error) {
    console.error("유저 직무 역할 조회 오류:", error);
    return [];
  }

  return (data || []).map((item) => ({
    userId: item.user_id,
    jobRoleId: item.store_job_roles?.[0]?.id,
    jobRoleName: item.store_job_roles?.[0]?.name,
    jobRoleCode: item.store_job_roles?.[0]?.code,
  }));
}

/**
 * 스케줄에서 역할 커버리지를 계산합니다.
 */
export function calculateRoleCoverage(
  roleRequirements: WorkItemRoleRequirement[],
  userJobRoles: UserJobRole[],
  assignedUsers: string[]
): RoleCoverage[] {
  // 역할별 요구 사항을 그룹화
  const requirementsByRole = new Map<string, WorkItemRoleRequirement>();
  roleRequirements.forEach((req) => {
    requirementsByRole.set(req.jobRoleId, req);
  });

  // 유저별 역할을 그룹화
  const userRolesByUser = new Map<string, string[]>();
  userJobRoles.forEach((userRole) => {
    if (!userRolesByUser.has(userRole.userId)) {
      userRolesByUser.set(userRole.userId, []);
    }
    userRolesByUser.get(userRole.userId)!.push(userRole.jobRoleId);
  });

  // 배정된 유저들의 역할별 카운트 계산
  const roleCounts = new Map<string, number>();
  assignedUsers.forEach((userId) => {
    const userRoles = userRolesByUser.get(userId) || [];
    userRoles.forEach((roleId) => {
      roleCounts.set(roleId, (roleCounts.get(roleId) || 0) + 1);
    });
  });

  // 역할 커버리지 계산
  return Array.from(requirementsByRole.values()).map((req) => {
    const currentCount = roleCounts.get(req.jobRoleId) || 0;
    const isSufficient = currentCount >= req.minCount;

    return {
      jobRoleId: req.jobRoleId,
      jobRoleName: req.jobRoleName,
      jobRoleCode: req.jobRoleCode,
      requiredCount: req.minCount,
      currentCount,
      isSufficient,
    };
  });
}

/**
 * 역할 커버리지가 충족되었는지 검증합니다.
 */
export function validateRoleCoverage(roleCoverage: RoleCoverage[]): {
  isValid: boolean;
  insufficientRoles: RoleCoverage[];
} {
  const insufficientRoles = roleCoverage.filter((role) => !role.isSufficient);

  return {
    isValid: insufficientRoles.length === 0,
    insufficientRoles,
  };
}

/**
 * 역할 커버리지 검증 결과를 사용자 친화적 메시지로 변환합니다.
 */
export function formatRoleCoverageMessage(
  insufficientRoles: RoleCoverage[],
  locale: Locale
): string {
  const safeLocale: Locale = isValidLocale(locale) ? locale : defaultLocale;

  if (insufficientRoles.length === 0) {
    if (safeLocale === "ko") {
      return "모든 역할 요구 사항이 충족되었습니다.";
    }
    if (safeLocale === "ja") {
      return "すべての役割要件が満たされています。";
    }
    return "All role requirements are satisfied.";
  }

  const roleMessages = insufficientRoles.map((role) => {
    const roleName = role.jobRoleCode || role.jobRoleName;
    if (safeLocale === "ko") {
      return `${roleName}: ${role.currentCount}/${role.requiredCount}명`;
    }
    if (safeLocale === "ja") {
      return `${roleName}: ${role.currentCount}/${role.requiredCount}人`;
    }
    return `${roleName}: ${role.currentCount}/${role.requiredCount} people`;
  });

  if (safeLocale === "ko") {
    return `역할 인원 부족: ${roleMessages.join(", ")}`;
  }
  if (safeLocale === "ja") {
    return `役割人員不足: ${roleMessages.join(", ")}`;
  }
  return `Insufficient role coverage: ${roleMessages.join(", ")}`;
}

/**
 * 스케줄 검증을 위한 통합 함수
 */
export async function validateScheduleRoleRequirements(
  storeId: string,
  workItemIds: string[],
  assignedUsers: string[],
  locale: Locale = defaultLocale
): Promise<{
  isValid: boolean;
  roleCoverage: RoleCoverage[];
  insufficientRoles: RoleCoverage[];
  message: string;
}> {
  try {
    // 1. 근무 항목의 역할 요구 사항 조회
    const roleRequirements = await getWorkItemRoleRequirements(workItemIds);

    if (roleRequirements.length === 0) {
      return {
        isValid: true,
        roleCoverage: [],
        insufficientRoles: [],
        message:
          locale === "ko"
            ? "역할 요구 사항이 없습니다."
            : locale === "ja"
              ? "役割要件がありません。"
              : "No role requirements found.",
      };
    }

    // 2. 유저들의 직무 역할 조회
    const userJobRoles = await getUserJobRoles(storeId, assignedUsers);

    // 3. 역할 커버리지 계산
    const roleCoverage = calculateRoleCoverage(
      roleRequirements,
      userJobRoles,
      assignedUsers
    );

    // 4. 검증
    const validation = validateRoleCoverage(roleCoverage);

    return {
      isValid: validation.isValid,
      roleCoverage,
      insufficientRoles: validation.insufficientRoles,
      message: formatRoleCoverageMessage(validation.insufficientRoles, locale),
    };
  } catch (error) {
    console.error("스케줄 역할 검증 오류:", error);
    return {
      isValid: false,
      roleCoverage: [],
      insufficientRoles: [],
      message:
        locale === "ko"
          ? "역할 검증 중 오류가 발생했습니다."
          : locale === "ja"
            ? "役割検証中にエラーが発生しました。"
            : "An error occurred during role validation.",
    };
  }
}
