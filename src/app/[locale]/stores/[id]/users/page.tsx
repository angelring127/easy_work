"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { useStore } from "@/contexts/store-context";
import { usePermissions, useAdminAccess } from "@/hooks/use-permissions";
import { ResponsiveHeader } from "@/components/layout/responsive-header";
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
import { Loader2, ArrowLeft } from "lucide-react";

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
  const {
    data: usersData,
    isLoading: usersLoading,
    error: usersError,
  } = useQuery({
    queryKey: ["store-users", storeId, filters],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/stores/${storeId}/users`);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log("API 응답:", result);

        // API 응답 구조 검증
        if (!result || typeof result !== "object") {
          console.error("잘못된 API 응답 구조:", result);
          return {
            members: [],
            pagination: {
              page: 1,
              limit: 20,
              total: 0,
              totalPages: 0,
            },
          };
        }

        // success가 false인 경우 처리
        if (result.success === false) {
          console.error("API 에러:", result.error);
          return {
            members: [],
            pagination: {
              page: 1,
              limit: 20,
              total: 0,
              totalPages: 0,
            },
          };
        }

        // data가 존재하는지 확인하고 fallback 제공
        if (!result.data) {
          console.warn("API 응답에 data가 없습니다:", result);
          return {
            members: [],
            pagination: {
              page: 1,
              limit: 20,
              total: 0,
              totalPages: 0,
            },
          };
        }

        return result.data;
      } catch (error) {
        console.error("사용자 목록 조회 중 오류 발생:", error);

        // 네트워크 오류나 기타 예외 발생 시 fallback 데이터 반환
        return {
          members: [],
          pagination: {
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 0,
          },
        };
      }
    },
    refetchOnWindowFocus: true, // 윈도우 포커스 시 새로고침
    refetchInterval: 3000, // 3초마다 자동 새로고침
    staleTime: 0, // 항상 최신 데이터 가져오기
    retry: 3, // 실패 시 3번 재시도
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // 지수 백오프
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
      <ResponsiveHeader
        userEmail={user?.email}
        currentStoreRole={userRole}
        locale={locale as string}
        onLogout={handleSignOut}
      />

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
        ) : usersError ? (
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
                사용자 목록을 불러올 수 없습니다
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
                            <TableHead>{t("user.guest", locale)}</TableHead>
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
                                    <Button
                                      variant="link"
                                      className="p-0 h-auto font-medium text-left"
                                      onClick={() => {
                                        // 게스트 사용자는 store_users.id를 사용, 일반 사용자는 user_id 사용
                                        const targetId = member.is_guest
                                          ? member.id
                                          : member.user_id;
                                        router.push(
                                          `/${locale}/stores/${storeId}/users/${targetId}`
                                        );
                                      }}
                                    >
                                      {member.name || t("user.noName", locale)}
                                    </Button>
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
                              <TableCell>
                                {member.email || (
                                  <span className="text-muted-foreground">
                                    -
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {getRoleDisplayName(member.role)}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {member.is_guest ? (
                                  <Badge variant="secondary">
                                    {t("user.guest", locale)}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline">
                                    {t("user.normal", locale)}
                                  </Badge>
                                )}
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
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      // 게스트 사용자는 store_users.id를 사용, 일반 사용자는 user_id 사용
                                      const targetId = member.is_guest
                                        ? member.id
                                        : member.user_id;
                                      router.push(
                                        `/${locale}/stores/${storeId}/users/${targetId}`
                                      );
                                    }}
                                    disabled={isUserDeleted(member)}
                                  >
                                    {t("user.viewDetail", locale)}
                                  </Button>

                                  {/* 비활성화/재활성화 버튼 - 마스터는 제외 */}
                                  {member.role !== "MASTER" && (
                                    <>
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
                                          {t("user.deactivate", locale)}
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
                                          {t("user.reactivate", locale)}
                                        </Button>
                                      )}
                                    </>
                                  )}

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
