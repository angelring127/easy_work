"use client";

import { ReactNode } from "react";
import { UserRole, Permission } from "@/types/auth";
import { usePermissions, useRole } from "@/hooks/use-permissions";

interface PermissionGuardProps {
  children: ReactNode;
  permission?: Permission;
  permissions?: Permission[];
  role?: UserRole;
  roles?: UserRole[];
  requireAll?: boolean; // true면 모든 권한/역할 필요, false면 하나만 있으면 됨
  fallback?: ReactNode;
  inverse?: boolean; // true면 권한이 없을 때 렌더링
}

/**
 * 권한 기반으로 컴포넌트 렌더링을 제어하는 가드 컴포넌트
 */
export function PermissionGuard({
  children,
  permission,
  permissions,
  role,
  roles,
  requireAll = false,
  fallback = null,
  inverse = false,
}: PermissionGuardProps) {
  const { canAccess, canAccessAny, canAccessMultiple, isAuthenticated } =
    usePermissions();
  const { role: userRole } = useRole();

  // 인증되지 않은 사용자는 기본적으로 접근 불가
  if (!isAuthenticated) {
    return inverse ? <>{children}</> : <>{fallback}</>;
  }

  let hasAccess = true;

  // 단일 권한 확인
  if (permission) {
    hasAccess = canAccess(permission);
  }

  // 다중 권한 확인
  if (permissions && permissions.length > 0) {
    if (requireAll) {
      hasAccess = canAccessMultiple(permissions);
    } else {
      hasAccess = canAccessAny(permissions);
    }
  }

  // 단일 역할 확인
  if (role) {
    hasAccess = hasAccess && userRole === role;
  }

  // 다중 역할 확인
  if (roles && roles.length > 0) {
    const hasRoleAccess = roles.includes(userRole);
    if (requireAll) {
      // requireAll이 true면 모든 조건을 만족해야 함
      hasAccess = hasAccess && hasRoleAccess;
    } else {
      // requireAll이 false면 역할 조건만 확인
      hasAccess = hasRoleAccess;
    }
  }

  // inverse가 true면 권한 로직을 뒤집음
  const shouldRender = inverse ? !hasAccess : hasAccess;

  return shouldRender ? <>{children}</> : <>{fallback}</>;
}

/**
 * 관리자만 접근 가능한 컴포넌트 가드
 */
export function AdminOnly({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <PermissionGuard
      roles={[UserRole.MASTER, UserRole.SUB_MANAGER]}
      fallback={fallback}
    >
      {children}
    </PermissionGuard>
  );
}

/**
 * 마스터 관리자만 접근 가능한 컴포넌트 가드
 */
export function MasterOnly({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <PermissionGuard role={UserRole.MASTER} fallback={fallback}>
      {children}
    </PermissionGuard>
  );
}

/**
 * 서브 관리자만 접근 가능한 컴포넌트 가드
 */
export function SubManagerOnly({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <PermissionGuard role={UserRole.SUB_MANAGER} fallback={fallback}>
      {children}
    </PermissionGuard>
  );
}

/**
 * 알바생만 접근 가능한 컴포넌트 가드
 */
export function PartTimerOnly({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <PermissionGuard role={UserRole.PART_TIMER} fallback={fallback}>
      {children}
    </PermissionGuard>
  );
}

/**
 * 인증된 사용자만 접근 가능한 컴포넌트 가드
 */
export function AuthenticatedOnly({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { isAuthenticated } = usePermissions();

  return isAuthenticated ? <>{children}</> : <>{fallback}</>;
}

/**
 * 인증되지 않은 사용자만 접근 가능한 컴포넌트 가드 (로그인/회원가입 페이지 등)
 */
export function UnauthenticatedOnly({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { isAuthenticated } = usePermissions();

  return !isAuthenticated ? <>{children}</> : <>{fallback}</>;
}





