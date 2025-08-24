"use client";

import { useMemo } from "react";
import { useAuth } from "@/contexts/auth-context";
import {
  Permission,
  UserRole,
  type PermissionCheck,
  type UserProfile,
} from "@/types/auth";
import {
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  checkAllPermissions,
  checkAnyPermission,
  checkUserPermission,
  getRoleDisplayName,
} from "@/lib/auth/permissions";

/**
 * 권한 관리를 위한 커스텀 훅
 */
export function usePermissions() {
  const { user } = useAuth();

  // 사용자 권한 확인 함수들을 메모이제이션
  const permissions = useMemo(() => {
    if (!user) {
      return {
        hasPermission: () => ({
          hasPermission: false,
          reason: "User not authenticated",
        }),
        hasAllPermissions: () => ({
          hasPermission: false,
          reason: "User not authenticated",
        }),
        hasAnyPermission: () => ({
          hasPermission: false,
          reason: "User not authenticated",
        }),
        canAccess: () => false,
        canAccessMultiple: () => false,
        canAccessAny: () => false,
        userRole: null,
        roleDisplayName: "",
        isAuthenticated: false,
      };
    }

    return {
      /**
       * 단일 권한 확인
       */
      hasPermission: (permission: Permission): PermissionCheck =>
        checkUserPermission(user, permission),

      /**
       * 모든 권한 확인
       */
      hasAllPermissions: (permissions: Permission[]): PermissionCheck =>
        checkAllPermissions(user.role, permissions),

      /**
       * 여러 권한 중 하나라도 확인
       */
      hasAnyPermission: (permissions: Permission[]): PermissionCheck =>
        checkAnyPermission(user.role, permissions),

      /**
       * 단일 권한 확인 (boolean 반환)
       */
      canAccess: (permission: Permission): boolean =>
        checkUserPermission(user, permission).hasPermission,

      /**
       * 모든 권한 확인 (boolean 반환)
       */
      canAccessMultiple: (permissions: Permission[]): boolean =>
        hasAllPermissions(user.role, permissions),

      /**
       * 여러 권한 중 하나라도 확인 (boolean 반환)
       */
      canAccessAny: (permissions: Permission[]): boolean =>
        hasAnyPermission(user.role, permissions),

      /**
       * 현재 사용자 역할
       */
      userRole: user.role,

      /**
       * 역할 표시명
       */
      roleDisplayName: getRoleDisplayName(user.role),

      /**
       * 인증 상태
       */
      isAuthenticated: true,
    };
  }, [user]);

  return permissions;
}

/**
 * 특정 역할인지 확인하는 훅
 */
export function useRole() {
  const { user } = useAuth();

  return useMemo(() => {
    if (!user) {
      return {
        isMaster: false,
        isSubManager: false,
        isPartTimer: false,
        role: null,
      };
    }

    return {
      isMaster: user.role === UserRole.MASTER,
      isSubManager: user.role === UserRole.SUB_MANAGER,
      isPartTimer: user.role === UserRole.PART_TIMER,
      role: user.role,
    };
  }, [user]);
}

/**
 * 관리자 권한 확인 훅
 */
export function useAdminAccess() {
  const { canAccess, canAccessAny } = usePermissions();

  return useMemo(
    () => ({
      canManageStore: canAccess(Permission.MANAGE_STORE),
      canManageUsers: canAccess(Permission.MANAGE_USER_ROLES),
      canCreateSchedule: canAccess(Permission.CREATE_SCHEDULE),
      canApproveShifts: canAccess(Permission.APPROVE_SHIFT_REQUEST),
      canViewAnalytics: canAccess(Permission.VIEW_ANALYTICS),
      canAccessAdminDashboard: canAccess(Permission.VIEW_ADMIN_DASHBOARD),
      canSendAnnouncements: canAccess(Permission.SEND_ANNOUNCEMENT),
      isManager: canAccessAny([
        Permission.MANAGE_STORE,
        Permission.VIEW_ADMIN_DASHBOARD,
      ]),
    }),
    [canAccess, canAccessAny]
  );
}

/**
 * 권한 기반 컴포넌트 렌더링을 위한 훅
 */
export function useConditionalRender() {
  const { canAccess, canAccessAny, canAccessMultiple } = usePermissions();

  return {
    /**
     * 권한이 있을 때만 자식 컴포넌트 렌더링
     */
    renderWithPermission: (permission: Permission, children: React.ReactNode) =>
      canAccess(permission) ? children : null,

    /**
     * 여러 권한 중 하나라도 있을 때 자식 컴포넌트 렌더링
     */
    renderWithAnyPermission: (
      permissions: Permission[],
      children: React.ReactNode
    ) => (canAccessAny(permissions) ? children : null),

    /**
     * 모든 권한이 있을 때만 자식 컴포넌트 렌더링
     */
    renderWithAllPermissions: (
      permissions: Permission[],
      children: React.ReactNode
    ) => (canAccessMultiple(permissions) ? children : null),

    /**
     * 특정 역할일 때만 자식 컴포넌트 렌더링
     */
    renderForRole: (role: UserRole, children: React.ReactNode) => {
      const { role: userRole } = useRole();
      return userRole === role ? children : null;
    },

    /**
     * 관리자일 때만 자식 컴포넌트 렌더링 (MASTER 또는 SUB_MANAGER)
     */
    renderForAdmins: (children: React.ReactNode) =>
      canAccessAny([Permission.MANAGE_STORE, Permission.VIEW_ADMIN_DASHBOARD])
        ? children
        : null,
  };
}
