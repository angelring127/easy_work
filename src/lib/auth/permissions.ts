// 권한 관련 유틸리티 함수들

import {
  UserRole,
  Permission,
  ROLE_PERMISSIONS,
  type PermissionCheck,
  type UserProfile,
} from "@/types/auth";
import { t, type Locale } from "@/lib/i18n";

/**
 * 사용자 역할의 표시명을 반환합니다
 * @param role 사용자 역할
 * @param locale 언어 설정
 * @returns 역할의 표시명
 */
export function getRoleDisplayName(
  role: UserRole,
  locale: Locale = "ko"
): string {
  switch (role) {
    case UserRole.MASTER:
      return t("invites.role.master", locale);
    case UserRole.SUB_MANAGER:
      return t("invites.role.subManager", locale);
    case UserRole.PART_TIMER:
      return t("invites.role.partTimer", locale);
    default:
      return role;
  }
}

/**
 * 사용자 역할이 특정 권한을 가지고 있는지 확인합니다
 * @param userRole 사용자 역할
 * @param permission 확인할 권한
 * @returns 권한 보유 여부
 */
export function hasPermission(
  userRole: UserRole,
  permission: Permission
): boolean {
  const rolePermissions = ROLE_PERMISSIONS[userRole];
  return rolePermissions.includes(permission);
}

/**
 * 사용자 역할이 여러 권한을 모두 가지고 있는지 확인합니다
 * @param userRole 사용자 역할
 * @param permissions 확인할 권한 배열
 * @returns 모든 권한 보유 여부
 */
export function hasAllPermissions(
  userRole: UserRole,
  permissions: Permission[]
): boolean {
  return permissions.every((permission) => hasPermission(userRole, permission));
}

/**
 * 사용자 역할이 여러 권한 중 하나라도 가지고 있는지 확인합니다
 * @param userRole 사용자 역할
 * @param permissions 확인할 권한 배열
 * @returns 하나 이상의 권한 보유 여부
 */
export function hasAnyPermission(
  userRole: UserRole,
  permissions: Permission[]
): boolean {
  return permissions.some((permission) => hasPermission(userRole, permission));
}

/**
 * 사용자 역할이 여러 권한을 모두 가지고 있는지 확인하고 PermissionCheck를 반환합니다
 * @param userRole 사용자 역할
 * @param permissions 확인할 권한 배열
 * @returns 권한 체크 결과
 */
export function checkAllPermissions(
  userRole: UserRole,
  permissions: Permission[]
): PermissionCheck {
  const hasAll = permissions.every((permission) =>
    hasPermission(userRole, permission)
  );

  if (!hasAll) {
    const missingPermissions = permissions.filter(
      (permission) => !hasPermission(userRole, permission)
    );
    const requiredRole = Math.max(
      ...missingPermissions.map((permission) =>
        getRoleLevel(getMinimumRoleForPermission(permission))
      )
    );
    const requiredRoleName =
      Object.values(UserRole).find(
        (role) => getRoleLevel(role) === requiredRole
      ) || UserRole.PART_TIMER;

    return {
      hasPermission: false,
      reason: `Requires ${getRoleDisplayName(
        requiredRoleName
      )} role or higher for all permissions`,
      requiredRole: requiredRoleName,
    };
  }

  return {
    hasPermission: true,
  };
}

/**
 * 사용자 역할이 여러 권한 중 하나라도 가지고 있는지 확인하고 PermissionCheck를 반환합니다
 * @param userRole 사용자 역할
 * @param permissions 확인할 권한 배열
 * @returns 권한 체크 결과
 */
export function checkAnyPermission(
  userRole: UserRole,
  permissions: Permission[]
): PermissionCheck {
  const hasAny = permissions.some((permission) =>
    hasPermission(userRole, permission)
  );

  if (!hasAny) {
    const requiredRole = Math.max(
      ...permissions.map((permission) =>
        getRoleLevel(getMinimumRoleForPermission(permission))
      )
    );
    const requiredRoleName =
      Object.values(UserRole).find(
        (role) => getRoleLevel(role) === requiredRole
      ) || UserRole.PART_TIMER;

    return {
      hasPermission: false,
      reason: `Requires ${getRoleDisplayName(
        requiredRoleName
      )} role or higher for any permission`,
      requiredRole: requiredRoleName,
    };
  }

  return {
    hasPermission: true,
  };
}

/**
 * 사용자 역할의 모든 권한을 반환합니다
 * @param userRole 사용자 역할
 * @returns 권한 배열
 */
export function getRolePermissions(userRole: UserRole): Permission[] {
  return ROLE_PERMISSIONS[userRole] || [];
}

/**
 * 권한이 필요한 최소 역할을 반환합니다
 * @param permission 확인할 권한
 * @returns 필요한 최소 역할
 */
export function getMinimumRoleForPermission(permission: Permission): UserRole {
  // 권한별 최소 역할 매핑
  const permissionMinRoles: Record<Permission, UserRole> = {
    // 매장 관리 권한
    [Permission.CREATE_STORE]: UserRole.MASTER,
    [Permission.MANAGE_STORE]: UserRole.SUB_MANAGER,
    [Permission.DELETE_STORE]: UserRole.MASTER,

    // 사용자 관리 권한
    [Permission.INVITE_USER]: UserRole.SUB_MANAGER,
    [Permission.MANAGE_USER_ROLES]: UserRole.MASTER,
    [Permission.REMOVE_USER]: UserRole.SUB_MANAGER,

    // 스케줄 관리 권한
    [Permission.CREATE_SCHEDULE]: UserRole.SUB_MANAGER,
    [Permission.EDIT_SCHEDULE]: UserRole.SUB_MANAGER,
    [Permission.DELETE_SCHEDULE]: UserRole.SUB_MANAGER,
    [Permission.VIEW_SCHEDULE]: UserRole.PART_TIMER,

    // 교대 요청 권한
    [Permission.CREATE_SHIFT_REQUEST]: UserRole.PART_TIMER,
    [Permission.APPROVE_SHIFT_REQUEST]: UserRole.SUB_MANAGER,
    [Permission.VIEW_SHIFT_REQUESTS]: UserRole.SUB_MANAGER,

    // 채팅 권한
    [Permission.GLOBAL_CHAT]: UserRole.PART_TIMER,
    [Permission.STORE_CHAT]: UserRole.PART_TIMER,
    [Permission.SEND_ANNOUNCEMENT]: UserRole.SUB_MANAGER,

    // 대시보드 권한
    [Permission.VIEW_ANALYTICS]: UserRole.MASTER,
    [Permission.VIEW_ADMIN_DASHBOARD]: UserRole.SUB_MANAGER,
  };

  return permissionMinRoles[permission] || UserRole.PART_TIMER;
}

/**
 * 역할의 권한 수준을 반환합니다 (숫자로 표현)
 * @param role 사용자 역할
 * @returns 권한 수준 (1: PART_TIMER, 2: SUB_MANAGER, 3: MASTER)
 */
export function getRoleLevel(role: UserRole): number {
  switch (role) {
    case UserRole.PART_TIMER:
      return 1;
    case UserRole.SUB_MANAGER:
      return 2;
    case UserRole.MASTER:
      return 3;
    default:
      return 0;
  }
}

/**
 * 첫 번째 역할이 두 번째 역할보다 높은 권한을 가지고 있는지 확인합니다
 * @param userRole 사용자 역할
 * @param targetRole 비교 대상 역할
 * @returns 권한 우위 여부
 */
export function hasHigherRole(
  userRole: UserRole,
  targetRole: UserRole
): boolean {
  return getRoleLevel(userRole) > getRoleLevel(targetRole);
}

/**
 * 첫 번째 역할이 두 번째 역할과 같거나 높은 권한을 가지고 있는지 확인합니다
 * @param userRole 사용자 역할
 * @param targetRole 비교 대상 역할
 * @returns 권한 우위 또는 동등 여부
 */
export function hasEqualOrHigherRole(
  userRole: UserRole,
  targetRole: UserRole
): boolean {
  return getRoleLevel(userRole) >= getRoleLevel(targetRole);
}

/**
 * 사용자가 다른 사용자의 역할을 변경할 수 있는지 확인합니다
 * @param currentUser 현재 사용자
 * @param targetUser 대상 사용자
 * @param newRole 새로운 역할
 * @returns 역할 변경 가능 여부
 */
export function canChangeUserRole(
  currentUser: UserProfile,
  targetUser: UserProfile,
  newRole: UserRole
): boolean {
  // 자신의 역할은 변경할 수 없음
  if (currentUser.id === targetUser.id) {
    return false;
  }

  // MASTER는 모든 사용자의 역할을 변경할 수 있음
  if (currentUser.role === UserRole.MASTER) {
    return true;
  }

  // SUB_MANAGER는 PART_TIMER의 역할만 변경할 수 있음
  if (currentUser.role === UserRole.SUB_MANAGER) {
    return (
      targetUser.role === UserRole.PART_TIMER && newRole === UserRole.PART_TIMER
    );
  }

  // PART_TIMER는 역할 변경 권한이 없음
  return false;
}

/**
 * 사용자 프로필과 권한을 확인하여 권한 체크 결과를 반환합니다
 * @param user 사용자 프로필
 * @param permission 확인할 권한
 * @returns 권한 체크 결과
 */
export function checkUserPermission(
  user: UserProfile,
  permission: Permission
): PermissionCheck {
  if (!user) {
    return {
      hasPermission: false,
      reason: "User not authenticated",
    };
  }

  const hasAccess = hasPermission(user.role, permission);

  if (!hasAccess) {
    const requiredRole = getMinimumRoleForPermission(permission);
    return {
      hasPermission: false,
      reason: `Requires ${getRoleDisplayName(requiredRole)} role or higher`,
      requiredRole,
    };
  }

  return {
    hasPermission: true,
  };
}
