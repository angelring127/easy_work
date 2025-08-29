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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { t } from "@/lib/i18n";
import { Locale } from "@/lib/i18n-config";
import { InvitationManager } from "@/features/invites/components/invitation-manager";
import { User, LogOut, Loader2, ArrowLeft } from "lucide-react";

interface UserManagementPageProps {
  params: Promise<{
    locale: string;
    id: string;
  }>;
}

export default function UserManagementPage({
  params,
}: UserManagementPageProps) {
  const resolvedParams = useParams();
  const locale = resolvedParams.locale as Locale;
  const storeId = resolvedParams.id as string;
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

  // 필터 상태
  const [filters, setFilters] = useState({
    role: "all",
    status: "all",
    search: "",
  });

  // 임시 근무 배치 상태
  const [isTemporaryAssignDialogOpen, setIsTemporaryAssignDialogOpen] =
    useState(false);
  const [temporaryAssignForm, setTemporaryAssignForm] = useState({
    userId: "",
    startDate: "",
    endDate: "",
    reason: "",
  });

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

  // 사용자 목록 조회
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ["store-users", storeId, filters],
    queryFn: async () => {
      const response = await fetch(`/api/stores/${storeId}/users`);
      const result = await response.json();
      console.log("API 응답:", result);
      return result.data;
    },
    refetchOnWindowFocus: true, // 윈도우 포커스 시 새로고침
    refetchInterval: 3000, // 3초마다 자동 새로고침
    staleTime: 0, // 항상 최신 데이터 가져오기
  });

  // 역할 부여
  const grantRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const response = await fetch(`/api/stores/${storeId}/roles/grant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
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
    mutationFn: async ({ userId }: { userId: string }) => {
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

  // 사용자 비활성화
  const deactivateUserMutation = useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      const response = await fetch(`/api/stores/${storeId}/users/deactivate`, {
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
        title: t("user.deactivateUser", locale),
        description: t("user.deactivateUserDescription", locale),
      });
    },
    onError: (error) => {
      toast({
        title: t("user.deactivateUserError", locale),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // 사용자 재활성화
  const reactivateUserMutation = useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      const response = await fetch(`/api/stores/${storeId}/users/reactivate`, {
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
        title: t("user.reactivateUser", locale),
        description: t("user.reactivateUserDescription", locale),
      });
    },
    onError: (error) => {
      toast({
        title: t("user.reactivateUserError", locale),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // 사용자 삭제
  const deleteUserMutation = useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
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
    },
    onError: (error) => {
      toast({
        title: t("user.deleteUserError", locale),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // 임시 근무 배치
  const temporaryAssignMutation = useMutation({
    mutationFn: async (data: {
      userId: string;
      startDate: string;
      endDate: string;
      reason: string;
    }) => {
      const response = await fetch(
        `/api/stores/${storeId}/members/temporary-assign`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      );
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-users", storeId] });
      setIsTemporaryAssignDialogOpen(false);
      setTemporaryAssignForm({
        userId: "",
        startDate: "",
        endDate: "",
        reason: "",
      });
      toast({
        title: t("user.temporaryAssigned", locale),
        description: t("user.temporaryAssignedDescription", locale),
      });
    },
    onError: (error) => {
      toast({
        title: t("user.temporaryAssignError", locale),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleGrantRole = (userId: string, role: string) => {
    grantRoleMutation.mutate({ userId, role });
  };

  const handleDemoteSubManager = (userId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: t("user.confirmDemote", locale),
      message: t("user.confirmDemoteMessage", locale),
      onConfirm: () => {
        demoteSubManagerMutation.mutate({ userId });
        setConfirmDialog({
          isOpen: false,
          title: "",
          message: "",
          onConfirm: () => {},
        });
      },
    });
  };

  const handleDeactivateUser = (userId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: t("user.confirmDeactivate", locale),
      message: t("user.confirmDeactivateMessage", locale),
      onConfirm: () => {
        deactivateUserMutation.mutate({ userId });
        setConfirmDialog({
          isOpen: false,
          title: "",
          message: "",
          onConfirm: () => {},
        });
      },
    });
  };

  const handleReactivateUser = (userId: string) => {
    reactivateUserMutation.mutate({ userId });
  };

  const handleDeleteUser = (userId: string) => {
    // 삭제된 사용자인지 확인
    const member = usersData?.members?.find((m: any) => m.user_id === userId);
    if (member && isUserDeleted(member)) {
      toast({
        title: t("user.alreadyDeleted", locale),
        description: t("user.alreadyDeletedDescription", locale),
        variant: "destructive",
      });
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: t("user.confirmDelete", locale),
      message: t("user.confirmDeleteMessage", locale),
      onConfirm: () => {
        deleteUserMutation.mutate({ userId });
        setConfirmDialog({
          isOpen: false,
          title: "",
          message: "",
          onConfirm: () => {},
        });
      },
    });
  };

  const handleTemporaryAssign = () => {
    if (
      !temporaryAssignForm.userId ||
      !temporaryAssignForm.startDate ||
      !temporaryAssignForm.endDate
    ) {
      toast({
        title: t("user.temporaryAssignError", locale),
        description: "모든 필드를 입력해주세요",
        variant: "destructive",
      });
      return;
    }

    temporaryAssignMutation.mutate(temporaryAssignForm);
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

  const getStatusDisplayName = (status: string, member: any) => {
    // 삭제된 사용자인 경우
    if (isUserDeleted(member)) {
      return "삭제됨";
    }

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

  const getStatusBadgeVariant = (status: string, member: any) => {
    // 삭제된 사용자인 경우
    if (isUserDeleted(member)) {
      return "secondary";
    }

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

  // 삭제된 사용자인지 확인하는 함수
  const isUserDeleted = (member: any) => {
    return member.deleted_at !== null && member.deleted_at !== undefined;
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
        ) : (
          <>
            <div className="mb-6">
              <div className="flex items-center space-x-4 mb-4">
                <Button
                  variant="ghost"
                  onClick={() => router.push(`/${locale}/dashboard`)}
                  className="flex items-center space-x-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>{t("common.back", locale)}</span>
                </Button>
              </div>
              <h1 className="text-3xl font-bold mb-2">
                {t("user.managementForStore", locale, {
                  storeName: currentStore?.name || "매장",
                })}
              </h1>
              <p className="text-muted-foreground">
                {t("user.management", locale)}
              </p>
            </div>

            <Tabs defaultValue="members" className="space-y-6">
              <TabsList>
                <TabsTrigger value="members">
                  {t("user.members", locale)}
                </TabsTrigger>
                <TabsTrigger value="invitations">
                  {t("invite.title", locale)}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="members" className="space-y-6">
                {/* 필터 */}
                <Card>
                  <CardHeader>
                    <CardTitle>{t("user.filters", locale)}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <Label>{t("user.role", locale)}</Label>
                        <Select
                          value={filters.role}
                          onValueChange={(value) =>
                            handleFilterChange("role", value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">
                              {t("user.allRoles", locale)}
                            </SelectItem>
                            <SelectItem value="MASTER">
                              {t("store.role.master", locale)}
                            </SelectItem>
                            <SelectItem value="SUB_MANAGER">
                              {t("store.role.sub_manager", locale)}
                            </SelectItem>
                            <SelectItem value="PART_TIMER">
                              {t("store.role.part_timer", locale)}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>{t("user.status", locale)}</Label>
                        <Select
                          value={filters.status}
                          onValueChange={(value) =>
                            handleFilterChange("status", value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">
                              {t("user.allStatuses", locale)}
                            </SelectItem>
                            <SelectItem value="ACTIVE">
                              {t("user.status.active", locale)}
                            </SelectItem>
                            <SelectItem value="PENDING">
                              {t("user.status.pending", locale)}
                            </SelectItem>
                            <SelectItem value="INACTIVE">
                              {t("user.status.inactive", locale)}
                            </SelectItem>
                            <SelectItem value="DELETED">삭제됨</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>{t("user.search", locale)}</Label>
                        <Input
                          placeholder={t("user.searchPlaceholder", locale)}
                          value={filters.search}
                          onChange={(e) =>
                            handleFilterChange("search", e.target.value)
                          }
                        />
                      </div>
                      <div className="flex items-end">
                        <Button
                          variant="outline"
                          onClick={() =>
                            setFilters({
                              role: "all",
                              status: "all",
                              search: "",
                            })
                          }
                        >
                          {t("user.clearFilters", locale)}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 사용자 목록 */}
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle>{t("user.members", locale)}</CardTitle>
                      <div className="flex items-center gap-2">
                        {usersData?.pagination && (
                          <Badge variant="outline">
                            {usersData.pagination.total}{" "}
                            {t("user.total", locale)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {usersLoading ? (
                      <div className="text-center py-8">
                        {t("dashboard.loading", locale)}
                      </div>
                    ) : usersData?.members?.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        {t("user.noMembers", locale)}
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("user.name", locale)}</TableHead>
                            <TableHead>{t("user.email", locale)}</TableHead>
                            <TableHead>{t("user.role", locale)}</TableHead>
                            <TableHead>{t("user.status", locale)}</TableHead>
                            <TableHead>{t("user.joinedAt", locale)}</TableHead>
                            <TableHead>{t("user.actions", locale)}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {usersData?.members?.map((member: any) => (
                            <TableRow
                              key={member.id}
                              className={
                                isUserDeleted(member)
                                  ? "bg-gray-100 opacity-60"
                                  : ""
                              }
                            >
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <Avatar>
                                    <AvatarImage
                                      src={member.avatar_url || ""}
                                    />
                                    <AvatarFallback>
                                      {member.name
                                        ? member.name.charAt(0).toUpperCase()
                                        : "?"}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <div className="font-medium">
                                      {member.name || t("user.noName", locale)}
                                    </div>
                                    {member.is_default_store && (
                                      <Badge
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        {t("user.defaultStore", locale)}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>{member.email}</TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {getRoleDisplayName(member.role)}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={getStatusBadgeVariant(
                                    member.status,
                                    member
                                  )}
                                >
                                  {getStatusDisplayName(member.status, member)}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {formatDate(member.granted_at)}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  {member.role === "PART_TIMER" && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        handleGrantRole(
                                          member.user_id,
                                          "SUB_MANAGER"
                                        )
                                      }
                                      disabled={
                                        grantRoleMutation.isPending ||
                                        isUserDeleted(member)
                                      }
                                    >
                                      {t("store.role.sub_manager", locale)} 승격
                                    </Button>
                                  )}
                                  {member.role === "SUB_MANAGER" && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        handleDemoteSubManager(member.user_id)
                                      }
                                      disabled={
                                        demoteSubManagerMutation.isPending ||
                                        isUserDeleted(member)
                                      }
                                    >
                                      {t("store.role.sub_manager", locale)} 전환
                                    </Button>
                                  )}
                                  {/* 비활성화/재활성화 버튼 */}
                                  {member.status === "ACTIVE" ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        handleDeactivateUser(member.user_id)
                                      }
                                      disabled={
                                        deactivateUserMutation.isPending ||
                                        isUserDeleted(member)
                                      }
                                    >
                                      비활성화
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        handleReactivateUser(member.user_id)
                                      }
                                      disabled={
                                        reactivateUserMutation.isPending ||
                                        isUserDeleted(member)
                                      }
                                    >
                                      재활성화
                                    </Button>
                                  )}

                                  {/* 삭제 버튼 */}
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() =>
                                      handleDeleteUser(member.user_id)
                                    }
                                    disabled={
                                      deleteUserMutation.isPending ||
                                      isUserDeleted(member) ||
                                      member.role === "MASTER"
                                    }
                                    title={
                                      member.role === "MASTER"
                                        ? "마스터 권한을 가진 사용자는 삭제할 수 없습니다"
                                        : ""
                                    }
                                  >
                                    {isUserDeleted(member) ? "삭제됨" : "삭제"}
                                  </Button>

                                  <Dialog
                                    open={isTemporaryAssignDialogOpen}
                                    onOpenChange={
                                      setIsTemporaryAssignDialogOpen
                                    }
                                  >
                                    <DialogTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                          setTemporaryAssignForm((prev) => ({
                                            ...prev,
                                            userId: member.user_id,
                                          }))
                                        }
                                        disabled={isUserDeleted(member)}
                                      >
                                        {t("user.temporaryAssign", locale)}
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                      <DialogHeader>
                                        <DialogTitle>
                                          {t("user.temporaryAssign", locale)}
                                        </DialogTitle>
                                      </DialogHeader>
                                      <div className="space-y-4">
                                        <div>
                                          <Label>
                                            {t("user.startDate", locale)}
                                          </Label>
                                          <Input
                                            type="date"
                                            value={
                                              temporaryAssignForm.startDate
                                            }
                                            onChange={(e) =>
                                              setTemporaryAssignForm(
                                                (prev) => ({
                                                  ...prev,
                                                  startDate: e.target.value,
                                                })
                                              )
                                            }
                                          />
                                        </div>
                                        <div>
                                          <Label>
                                            {t("user.endDate", locale)}
                                          </Label>
                                          <Input
                                            type="date"
                                            value={temporaryAssignForm.endDate}
                                            onChange={(e) =>
                                              setTemporaryAssignForm(
                                                (prev) => ({
                                                  ...prev,
                                                  endDate: e.target.value,
                                                })
                                              )
                                            }
                                          />
                                        </div>
                                        <div>
                                          <Label>
                                            {t("user.reason", locale)}
                                          </Label>
                                          <Textarea
                                            placeholder={t(
                                              "user.reasonPlaceholder",
                                              locale
                                            )}
                                            value={temporaryAssignForm.reason}
                                            onChange={(e) =>
                                              setTemporaryAssignForm(
                                                (prev) => ({
                                                  ...prev,
                                                  reason: e.target.value,
                                                })
                                              )
                                            }
                                          />
                                        </div>
                                        <Button
                                          onClick={handleTemporaryAssign}
                                          disabled={
                                            temporaryAssignMutation.isPending
                                          }
                                          className="w-full"
                                        >
                                          {temporaryAssignMutation.isPending
                                            ? t("dashboard.loading", locale)
                                            : t("user.assign", locale)}
                                        </Button>
                                      </div>
                                    </DialogContent>
                                  </Dialog>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="invitations">
                <InvitationManager storeId={storeId} locale={locale} />
              </TabsContent>
            </Tabs>

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
