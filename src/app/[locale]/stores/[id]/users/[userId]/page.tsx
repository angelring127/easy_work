"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { useStore } from "@/contexts/store-context";
import { usePermissions, useAdminAccess } from "@/hooks/use-permissions";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { StoreSwitcher } from "@/components/ui/store-switcher";
import { RoleBadge } from "@/components/auth/role-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { t } from "@/lib/i18n";
import { Locale } from "@/lib/i18n-config";
import {
  User,
  LogOut,
  Loader2,
  ArrowLeft,
  Save,
  Trash2,
  UserPlus,
} from "lucide-react";

interface UserDetailPageProps {
  params: Promise<{
    locale: string;
    id: string;
    userId: string;
  }>;
}

interface UserDetail {
  id: string;
  email: string | null;
  name: string;
  isGuest?: boolean;
  role: string;
  status: string;
  joinedAt: string;
  isDefaultStore: boolean;
  jobRoles: Array<{
    id: string;
    store_job_roles: {
      id: string;
      name: string;
      code: string;
      description: string;
      active: boolean;
    };
  }>;
  resignationDate: string | null;
  desiredWeeklyHours: number | null;
  preferredWeekdays: Array<{
    weekday: number;
    is_preferred: boolean;
  }>;
  avatarUrl: string | null;
}

interface StoreJobRole {
  id: string;
  name: string;
  code: string;
  description: string;
  active: boolean;
}

export default function UserDetailPage({ params }: UserDetailPageProps) {
  const resolvedParams = useParams();
  const locale = resolvedParams.locale as Locale;
  const storeId = resolvedParams.id as string;
  const userId = resolvedParams.userId as string;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const {
    currentStore,
    accessibleStores,
    isLoading: storesLoading,
  } = useStore();
  const { userRole } = usePermissions();
  const { canManageUsers, isManager } = useAdminAccess();

  // 폼 상태
  const [formData, setFormData] = useState({
    jobRoleIds: [] as string[],
    resignationDate: "",
    desiredWeeklyHours: "",
    preferredWeekdays: [] as Array<{ weekday: number; isPreferred: boolean }>,
  });

  // 이름 입력 상태
  const [userName, setUserName] = useState("");

  // 확인 다이얼로그 상태
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  // 권한 검증
  useEffect(() => {
    if (!loading && !storesLoading) {
      if (!user) {
        router.push(`/${locale}/login`);
        return;
      }

      if (!canManageUsers) {
        toast({
          title: "권한 없음",
          description: "사용자 관리 권한이 없습니다.",
          variant: "destructive",
        });
        router.push(`/${locale}/dashboard`);
        return;
      }
    }
  }, [loading, storesLoading, user, canManageUsers, router, locale, toast]);

  // 로딩 중인 경우
  const isLoadingPage = loading || storesLoading;

  const handleSignOut = async () => {
    await signOut();
    router.push(`/${locale}/login`);
  };

  // 사용자 상세 정보 조회
  const {
    data: userDetail,
    isLoading: userDetailLoading,
    error: userDetailError,
  } = useQuery({
    queryKey: ["user-detail", storeId, userId],
    queryFn: async () => {
      const response = await fetch(`/api/stores/${storeId}/users/${userId}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data as UserDetail;
    },
    enabled: !!storeId && !!userId,
  });

  // 매장 직무 역할 목록 조회
  const { data: availableJobRoles, isLoading: jobRolesLoading } = useQuery({
    queryKey: ["store-job-roles", storeId],
    queryFn: async () => {
      const response = await fetch(`/api/store-job-roles?store_id=${storeId}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data as StoreJobRole[];
    },
    enabled: !!storeId,
  });

  // 사용자 상세 정보가 로드되면 폼 데이터 초기화
  useEffect(() => {
    if (userDetail) {
      setFormData({
        jobRoleIds: userDetail.jobRoles.map((jr) => jr.store_job_roles.id),
        resignationDate: userDetail.resignationDate || "",
        desiredWeeklyHours: userDetail.desiredWeeklyHours?.toString() || "",
        preferredWeekdays: userDetail.preferredWeekdays.map((pw) => ({
          weekday: pw.weekday,
          isPreferred: pw.is_preferred,
        })),
      });
      // 이름 상태도 초기화
      setUserName(userDetail.name || "");
    }
  }, [userDetail]);

  // 프로필 업데이트
  const updateProfileMutation = useMutation({
    mutationFn: async (data: {
      name?: string;
      jobRoleIds?: string[];
      resignationDate?: string | null;
      desiredWeeklyHours?: number | null;
      preferredWeekdays?: Array<{ weekday: number; isPreferred: boolean }>;
    }) => {
      const response = await fetch(`/api/stores/${storeId}/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error);
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["user-detail", storeId, userId],
      });
      queryClient.invalidateQueries({ queryKey: ["store-users", storeId] });
      toast({
        title: t("user.profileUpdated", locale),
        description: t("user.profileUpdatedDescription", locale),
      });
    },
    onError: (error) => {
      // 에러 메시지가 번역 키인지 확인
      const errorMessage = error.message.startsWith("user.")
        ? t(error.message, locale)
        : error.message;
      
      toast({
        title: t("user.profileUpdateError", locale),
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // 서브 매니저 승격
  const promoteToSubManagerMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/stores/${storeId}/roles/grant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: "SUB_MANAGER" }),
      });
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["user-detail", storeId, userId],
      });
      queryClient.invalidateQueries({ queryKey: ["store-users", storeId] });
      toast({
        title: t("user.roleGranted", locale),
        description: t("user.roleGrantedDescription", locale),
      });
    },
    onError: (error) => {
      toast({
        title: t("user.roleGrantError", locale),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // 서브 매니저 전환 (파트타이머로)
  const demoteSubManagerMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/stores/${storeId}/users/demote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["user-detail", storeId, userId],
      });
      queryClient.invalidateQueries({ queryKey: ["store-users", storeId] });
      toast({
        title: t("user.demoteSubManager", locale),
        description: t("user.demoteSubManagerDescription", locale),
      });
    },
    onError: (error) => {
      toast({
        title: t("user.demoteSubManagerError", locale),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // 사용자 삭제
  const deleteUserMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/stores/${storeId}/users/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-users", storeId] });
      toast({
        title: t("user.deleteUser", locale),
        description: t("user.deleteUserDescription", locale),
      });
      router.push(`/${locale}/stores/${storeId}/users`);
    },
    onError: (error) => {
      toast({
        title: t("user.deleteUserError", locale),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFormChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleJobRoleChange = (jobRoleId: string, checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      jobRoleIds: checked
        ? [...prev.jobRoleIds, jobRoleId]
        : prev.jobRoleIds.filter((id) => id !== jobRoleId),
    }));
  };

  const handlePreferredWeekdayChange = (
    weekday: number,
    isPreferred: boolean
  ) => {
    setFormData((prev) => {
      const existingIndex = prev.preferredWeekdays.findIndex(
        (pw) => pw.weekday === weekday
      );

      if (existingIndex >= 0) {
        // 기존 항목 업데이트
        const updated = [...prev.preferredWeekdays];
        updated[existingIndex] = { weekday, isPreferred };
        return { ...prev, preferredWeekdays: updated };
      } else {
        // 새 항목 추가
        return {
          ...prev,
          preferredWeekdays: [
            ...prev.preferredWeekdays,
            { weekday, isPreferred },
          ],
        };
      }
    });
  };

  const handleSave = () => {
    const updateData: any = {};

    if (
      formData.jobRoleIds !==
      userDetail?.jobRoles.map((jr) => jr.store_job_roles.id)
    ) {
      updateData.jobRoleIds = formData.jobRoleIds;
    }

    if (formData.resignationDate !== (userDetail?.resignationDate || "")) {
      updateData.resignationDate = formData.resignationDate || null;
    }

    if (
      formData.desiredWeeklyHours !==
      (userDetail?.desiredWeeklyHours?.toString() || "")
    ) {
      updateData.desiredWeeklyHours = formData.desiredWeeklyHours
        ? parseInt(formData.desiredWeeklyHours)
        : null;
    }

    // 출근이 어려운 요일 변경 확인 (빈 배열도 업데이트 가능)
    const currentWeekdays = userDetail?.preferredWeekdays || [];
    const hasWeekdayChanges =
      formData.preferredWeekdays.length !== currentWeekdays.length ||
      formData.preferredWeekdays.some((pw) => {
        const current = currentWeekdays.find((cw) => cw.weekday === pw.weekday);
        return !current || current.is_preferred !== pw.isPreferred;
      }) ||
      currentWeekdays.some((cw) => {
        const form = formData.preferredWeekdays.find((pw) => pw.weekday === cw.weekday);
        return !form;
      });

    if (hasWeekdayChanges) {
      updateData.preferredWeekdays = formData.preferredWeekdays;
    }

    if (Object.keys(updateData).length > 0) {
      updateProfileMutation.mutate(updateData);
    }
  };

  const handlePromoteToSubManager = () => {
    setConfirmDialog({
      isOpen: true,
      title: t("store.role.sub_manager", locale) + " 승격",
      message: "이 사용자를 서브 매니저로 승격하시겠습니까?",
      onConfirm: () => {
        promoteToSubManagerMutation.mutate();
        setConfirmDialog({
          isOpen: false,
          title: "",
          message: "",
          onConfirm: () => {},
        });
      },
    });
  };

  const handleDemoteSubManager = () => {
    setConfirmDialog({
      isOpen: true,
      title: t("user.confirmDemote", locale),
      message: t("user.confirmDemoteMessage", locale),
      onConfirm: () => {
        demoteSubManagerMutation.mutate();
        setConfirmDialog({
          isOpen: false,
          title: "",
          message: "",
          onConfirm: () => {},
        });
      },
    });
  };

  const handleDeleteUser = () => {
    setConfirmDialog({
      isOpen: true,
      title: t("user.confirmDelete", locale),
      message: t("user.confirmDeleteMessage", locale),
      onConfirm: () => {
        deleteUserMutation.mutate();
        setConfirmDialog({
          isOpen: false,
          title: "",
          message: "",
          onConfirm: () => {},
        });
      },
    });
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case "MASTER":
        return t("store.role.master", locale);
      case "SUB_MANAGER":
        return t("store.role.sub_manager", locale);
      case "PART_TIMER":
        return t("store.role.part_timer", locale);
      default:
        return role || "part_timer";
    }
  };

  const getStatusDisplayName = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return t("user.status.active", locale);
      case "PENDING":
        return t("user.status.pending", locale);
      case "INACTIVE":
        return t("user.status.inactive", locale);
      default:
        return status;
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "default";
      case "PENDING":
        return "secondary";
      case "INACTIVE":
        return "destructive";
      default:
        return "outline";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <h1 className="text-3xl font-bold text-gray-900">Workeasy</h1>
            </div>
            <div className="flex items-center space-x-4">
              <LanguageSwitcher />
              <StoreSwitcher />
              <div className="flex items-center space-x-2">
                <User className="h-5 w-5" />
                <span className="text-sm font-medium">
                  {user?.email || "Unknown"}
                </span>
                {userRole && <RoleBadge role={userRole} className="text-xs" />}
              </div>
              <Button
                variant="outline"
                onClick={handleSignOut}
                className="flex items-center space-x-2"
              >
                <LogOut className="h-4 w-4" />
                <span>{t("dashboard.logout", locale)}</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* 로딩 중인 경우 */}
        {isLoadingPage ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-blue-600" />
              <p className="text-lg font-medium text-gray-700">
                {t("dashboard.loading", locale)}
              </p>
            </div>
          </div>
        ) : !user ? (
          <div className="text-center py-12">
            <p className="text-gray-500">인증되지 않은 사용자입니다.</p>
          </div>
        ) : userDetailError ? (
          <div className="text-center py-12">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md mx-auto">
              <div className="flex items-center justify-center mb-4">
                <div className="bg-red-100 rounded-full p-3">
                  <svg
                    className="h-6 w-6 text-red-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                    />
                  </svg>
                </div>
              </div>
              <h3 className="text-lg font-medium text-red-800 mb-2">
                사용자 정보를 불러올 수 없습니다
              </h3>
              <p className="text-red-600 mb-4">
                네트워크 연결을 확인하고 다시 시도해주세요.
              </p>
              <Button
                onClick={() => window.location.reload()}
                variant="outline"
                className="border-red-300 text-red-700 hover:bg-red-50"
              >
                새로고침
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <div className="flex items-center space-x-4 mb-4">
                <Button
                  variant="ghost"
                  onClick={() =>
                    router.push(`/${locale}/stores/${storeId}/users`)
                  }
                  className="flex items-center space-x-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>{t("user.backToUserList", locale)}</span>
                </Button>
              </div>
              <h1 className="text-3xl font-bold mb-2">
                {t("user.detailForStore", locale, {
                  storeName: currentStore?.name || "매장",
                  userName: userDetail?.name || "사용자",
                })}
              </h1>
              <p className="text-muted-foreground">
                {t("user.detail", locale)}
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* 기본 정보 */}
              <div className="lg:col-span-1">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      {t("user.basicInfo", locale)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-16 w-16">
                        <AvatarImage src={userDetail?.avatarUrl || ""} />
                        <AvatarFallback>
                          {userDetail?.name
                            ? userDetail.name.charAt(0).toUpperCase()
                            : "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        {canManageUsers && (
                          <div className="space-y-2 mb-3">
                            <Label htmlFor="user-name">
                              {t("user.name", locale)}
                            </Label>
                            <div className="flex gap-2">
                              <Input
                                id="user-name"
                                value={userName}
                                onChange={(e) => setUserName(e.target.value)}
                                placeholder={t("user.name", locale)}
                                className="flex-1"
                              />
                              <Button
                                size="sm"
                                onClick={() => {
                                  if (userName.trim()) {
                                    updateProfileMutation.mutate({
                                      name: userName.trim(),
                                    });
                                  }
                                }}
                                disabled={updateProfileMutation.isPending || !userName.trim()}
                              >
                                {updateProfileMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Save className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </div>
                        )}
                        {!canManageUsers && (
                          <h3 className="text-lg font-semibold">
                            {userDetail?.name || t("user.noName", locale)}
                          </h3>
                        )}
                        {userDetail?.isGuest ? (
                          <Badge variant="secondary" className="mt-1">
                            게스트 사용자
                          </Badge>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            {userDetail?.email || "-"}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">
                          {t("user.role", locale)}:
                        </span>
                        <Badge variant="outline">
                          {getRoleDisplayName(userDetail?.role || "")}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">
                          {t("user.status", locale)}:
                        </span>
                        <Badge
                          variant={getStatusBadgeVariant(
                            userDetail?.status || ""
                          )}
                        >
                          {getStatusDisplayName(userDetail?.status || "")}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">
                          {t("user.joinedAt", locale)}:
                        </span>
                        <span className="text-sm">
                          {userDetail?.joinedAt
                            ? formatDate(userDetail.joinedAt)
                            : "-"}
                        </span>
                      </div>
                      {userDetail?.isDefaultStore && (
                        <div className="flex justify-between">
                          <span className="text-sm font-medium">
                            {t("user.defaultStore", locale)}:
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {t("user.defaultStore", locale)}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 편집 가능한 정보 */}
              <div className="lg:col-span-2 space-y-6">
                {/* 직무 역할 */}
                <Card>
                  <CardHeader>
                    <CardTitle>{t("user.jobRoles", locale)}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {jobRolesLoading ? (
                      <div className="text-center py-4">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {availableJobRoles
                          ?.filter((role) => role.active)
                          .map((role) => (
                            <div
                              key={role.id}
                              className="flex items-center space-x-2"
                            >
                              <Checkbox
                                id={role.id}
                                checked={formData.jobRoleIds.includes(role.id)}
                                onCheckedChange={(checked) =>
                                  handleJobRoleChange(
                                    role.id,
                                    checked as boolean
                                  )
                                }
                              />
                              <Label htmlFor={role.id} className="flex-1">
                                <div>
                                  <div className="font-medium">{role.name}</div>
                                  {role.description && (
                                    <div className="text-sm text-muted-foreground">
                                      {role.description}
                                    </div>
                                  )}
                                </div>
                              </Label>
                            </div>
                          ))}
                        {availableJobRoles?.filter((role) => role.active)
                          .length === 0 && (
                          <p className="text-sm text-muted-foreground">
                            설정된 직무 역할이 없습니다.
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 근무 선호도 */}
                <Card>
                  <CardHeader>
                    <CardTitle>{t("user.workPreferences", locale)}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="resignationDate">
                        {t("user.resignationDate", locale)}
                      </Label>
                      <Input
                        id="resignationDate"
                        type="date"
                        value={formData.resignationDate}
                        onChange={(e) =>
                          handleFormChange("resignationDate", e.target.value)
                        }
                        className="mt-1"
                      />
                      {formData.resignationDate && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleFormChange("resignationDate", "")
                          }
                          className="mt-2"
                        >
                          {t("user.removeResignationDate", locale)}
                        </Button>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="desiredWeeklyHours">
                        {t("user.desiredWeeklyHours", locale)}
                      </Label>
                      <Input
                        id="desiredWeeklyHours"
                        type="number"
                        min="0"
                        max="168"
                        placeholder={t(
                          "user.desiredWeeklyHoursPlaceholder",
                          locale
                        )}
                        value={formData.desiredWeeklyHours}
                        onChange={(e) =>
                          handleFormChange("desiredWeeklyHours", e.target.value)
                        }
                        className="mt-1"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* 희망 근무 요일 */}
                <Card>
                    <CardHeader>
                      <CardTitle>{t("user.preferredWeekdays", locale)}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">
                        {t("user.preferredWeekdays.description", locale)}
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {[
                        {
                          weekday: 0,
                          label: t("user.weekdays.sunday", locale),
                        },
                        {
                          weekday: 1,
                          label: t("user.weekdays.monday", locale),
                        },
                        {
                          weekday: 2,
                          label: t("user.weekdays.tuesday", locale),
                        },
                        {
                          weekday: 3,
                          label: t("user.weekdays.wednesday", locale),
                        },
                        {
                          weekday: 4,
                          label: t("user.weekdays.thursday", locale),
                        },
                        {
                          weekday: 5,
                          label: t("user.weekdays.friday", locale),
                        },
                        {
                          weekday: 6,
                          label: t("user.weekdays.saturday", locale),
                        },
                      ].map(({ weekday, label }) => {
                        const isChecked = formData.preferredWeekdays.some(
                          (pw) => pw.weekday === weekday && pw.isPreferred
                        );

                        return (
                          <div
                            key={weekday}
                            className="flex items-center space-x-2"
                          >
                            <Checkbox
                              id={`weekday-${weekday}`}
                              checked={isChecked}
                              onCheckedChange={(checked) =>
                                handlePreferredWeekdayChange(
                                  weekday,
                                  checked as boolean
                                )
                              }
                            />
                            <Label
                              htmlFor={`weekday-${weekday}`}
                              className="text-sm"
                            >
                              {label}
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* 관리자 액션 */}
                <Card>
                  <CardHeader>
                    <CardTitle>관리자 액션</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {userDetail?.role === "PART_TIMER" && (
                        <Button
                          onClick={handlePromoteToSubManager}
                          disabled={promoteToSubManagerMutation.isPending}
                          className="flex items-center gap-2"
                        >
                          <UserPlus className="h-4 w-4" />
                          {t("store.role.sub_manager", locale)} 승격
                        </Button>
                      )}

                      {userDetail?.role === "SUB_MANAGER" && (
                        <Button
                          variant="outline"
                          onClick={handleDemoteSubManager}
                          disabled={demoteSubManagerMutation.isPending}
                        >
                          {t("store.role.sub_manager", locale)} 전환
                        </Button>
                      )}

                      {userDetail?.role !== "MASTER" && (
                        <Button
                          variant="destructive"
                          onClick={handleDeleteUser}
                          disabled={deleteUserMutation.isPending}
                          className="flex items-center gap-2"
                        >
                          <Trash2 className="h-4 w-4" />
                          삭제
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* 저장 버튼 */}
                <div className="flex justify-end">
                  <Button
                    onClick={handleSave}
                    disabled={updateProfileMutation.isPending}
                    className="flex items-center gap-2"
                  >
                    <Save className="h-4 w-4" />
                    {updateProfileMutation.isPending
                      ? t("dashboard.loading", locale)
                      : t("user.updateProfile", locale)}
                  </Button>
                </div>
              </div>
            </div>

            {/* 확인 다이얼로그 */}
            <Dialog
              open={confirmDialog.isOpen}
              onOpenChange={(open) =>
                !open &&
                setConfirmDialog({
                  isOpen: false,
                  title: "",
                  message: "",
                  onConfirm: () => {},
                })
              }
            >
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{confirmDialog.title}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {confirmDialog.message}
                  </p>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() =>
                        setConfirmDialog({
                          isOpen: false,
                          title: "",
                          message: "",
                          onConfirm: () => {},
                        })
                      }
                    >
                      취소
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={confirmDialog.onConfirm}
                    >
                      확인
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </>
        )}
      </main>
    </div>
  );
}
