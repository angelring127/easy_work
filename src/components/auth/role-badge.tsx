"use client";

import { UserRole } from "@/types/auth";
import { getRoleDisplayName } from "@/lib/auth/permissions";
import { Badge } from "@/components/ui/badge";
import { t, type Locale } from "@/lib/i18n";
import { useParams } from "next/navigation";

interface RoleBadgeProps {
  role: UserRole;
  variant?: "default" | "secondary" | "destructive" | "outline";
  className?: string;
}

/**
 * 사용자 역할을 시각적으로 표시하는 배지 컴포넌트
 */
export function RoleBadge({
  role,
  variant = "default",
  className,
}: RoleBadgeProps) {
  const { locale } = useParams();
  const currentLocale = (locale as Locale) || "ko";

  // 역할별 스타일 매핑
  const getRoleVariant = (role: UserRole) => {
    switch (role) {
      case UserRole.MASTER:
        return "default"; // 기본 색상 (파란색)
      case UserRole.SUB_MANAGER:
        return "secondary"; // 회색
      case UserRole.PART_TIMER:
        return "outline"; // 테두리만
      default:
        return "outline";
    }
  };

  // 역할별 색상 클래스
  const getRoleColorClass = (role: UserRole) => {
    switch (role) {
      case UserRole.MASTER:
        return "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200";
      case UserRole.SUB_MANAGER:
        return "bg-green-100 text-green-800 border-green-200 hover:bg-green-200";
      case UserRole.PART_TIMER:
        return "bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200";
    }
  };

  const displayName = getRoleDisplayName(role, currentLocale);
  const badgeVariant = variant === "default" ? getRoleVariant(role) : variant;
  const colorClass = getRoleColorClass(role);

  return (
    <Badge
      variant={badgeVariant}
      className={`${colorClass} ${className || ""}`}
    >
      {displayName}
    </Badge>
  );
}

/**
 * 현재 사용자의 역할을 표시하는 컴포넌트
 */
export function CurrentUserRoleBadge({ className }: { className?: string }) {
  const { role: userRole } = usePermissions();

  if (!userRole) {
    return null;
  }

  return <RoleBadge role={userRole} className={className} />;
}

// 권한 훅 임포트 (순환 참조 방지를 위해 지연 임포트)
function usePermissions() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { useRole } = require("@/hooks/use-permissions");
  return useRole();
}





