"use client";

import { useState } from "react";
import { UserRole, type UserProfile } from "@/types/auth";
import { getRoleDisplayName, canChangeUserRole } from "@/lib/auth/permissions";
import { useAuth } from "@/contexts/auth-context";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RoleBadge } from "./role-badge";
import { useToast } from "@/hooks/use-toast";
import { t, type Locale } from "@/lib/i18n";
import { useParams } from "next/navigation";

interface UserRoleManagerProps {
  user: UserProfile;
  onRoleChange?: (userId: string, newRole: UserRole) => Promise<void>;
  className?: string;
}

/**
 * 사용자 역할 관리 컴포넌트
 */
export function UserRoleManager({
  user,
  onRoleChange,
  className,
}: UserRoleManagerProps) {
  const { locale } = useParams();
  const currentLocale = (locale as Locale) || "ko";
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const [selectedRole, setSelectedRole] = useState<UserRole>(user.role);
  const [isLoading, setIsLoading] = useState(false);

  if (!currentUser) {
    return null;
  }

  // 현재 사용자가 대상 사용자의 역할을 변경할 수 있는지 확인
  const canChangeRole = canChangeUserRole(currentUser, user, selectedRole);

  const handleRoleChange = async () => {
    if (!canChangeRole || selectedRole === user.role) {
      return;
    }

    setIsLoading(true);
    try {
      if (onRoleChange) {
        await onRoleChange(user.id, selectedRole);
        toast({
          title: t("role.change.success", currentLocale),
          description: t("role.change.description", currentLocale),
        });
      }
    } catch (error) {
      console.error("Role change error:", error);
      toast({
        title: t("role.change.error", currentLocale),
        description: t("role.change.errorDescription", currentLocale),
        variant: "destructive",
      });
      setSelectedRole(user.role); // 원래 역할로 되돌리기
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleOptions = () => {
    const roles = Object.values(UserRole);
    return roles.filter((role) => {
      // 현재 사용자가 설정할 수 있는 역할만 필터링
      const changeCheck = canChangeUserRole(currentUser, user, role);
      return changeCheck;
    });
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{t("role.management.title", currentLocale)}</span>
          <RoleBadge role={user.role} />
        </CardTitle>
        <CardDescription>
          {t("role.management.description", currentLocale)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">
            {t("role.management.userInfo", currentLocale)}
          </label>
          <div className="text-sm text-gray-600">
            <p>
              <strong>{t("common.email", currentLocale)}:</strong> {user.email}
            </p>
            <p>
              <strong>{t("common.name", currentLocale)}:</strong> {user.name}
            </p>
            <p>
              <strong>
                {t("role.management.currentRole", currentLocale)}:
              </strong>{" "}
              {getRoleDisplayName(user.role, currentLocale)}
            </p>
          </div>
        </div>

        {canChangeRole ? (
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {t("role.management.newRole", currentLocale)}
            </label>
            <Select
              value={selectedRole}
              onValueChange={(value) => setSelectedRole(value as UserRole)}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={t("role.management.selectRole", currentLocale)}
                />
              </SelectTrigger>
              <SelectContent>
                {getRoleOptions().map((role) => (
                  <SelectItem key={role} value={role}>
                    <div className="flex items-center space-x-2">
                      <span>{getRoleDisplayName(role, currentLocale)}</span>
                      {role === user.role && (
                        <Badge variant="outline" className="text-xs">
                          {t("role.management.current", currentLocale)}
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
            {t("role.management.noPermission", currentLocale)}
          </div>
        )}

        {canChangeRole && selectedRole !== user.role && (
          <Button
            onClick={handleRoleChange}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading
              ? t("role.management.changing", currentLocale)
              : t("role.management.changeRole", currentLocale)}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * 사용자 목록과 역할 관리를 위한 테이블 컴포넌트
 */
interface UserRoleTableProps {
  users: UserProfile[];
  onRoleChange?: (userId: string, newRole: UserRole) => Promise<void>;
  className?: string;
}

export function UserRoleTable({
  users,
  onRoleChange,
  className,
}: UserRoleTableProps) {
  const { locale } = useParams();
  const currentLocale = (locale as Locale) || "ko";

  return (
    <div className={`space-y-4 ${className || ""}`}>
      <h3 className="text-lg font-semibold">
        {t("role.management.userList", currentLocale)}
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map((user) => (
          <UserRoleManager
            key={user.id}
            user={user}
            onRoleChange={onRoleChange}
          />
        ))}
      </div>
    </div>
  );
}
