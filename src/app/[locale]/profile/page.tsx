"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { useStore } from "@/contexts/store-context";
import { usePermissions } from "@/hooks/use-permissions";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { StoreSwitcher } from "@/components/ui/store-switcher";
import { RoleBadge } from "@/components/auth/role-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { t } from "@/lib/i18n";
import { Locale } from "@/lib/i18n-config";
import {
  User,
  LogOut,
  Loader2,
  ArrowLeft,
  Key,
  Eye,
  EyeOff,
  Calendar,
} from "lucide-react";

interface ProfilePageProps {
  params: Promise<{
    locale: string;
  }>;
}

interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  joinedAt: string;
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
  avatarUrl: string | null;
}

export default function ProfilePage({ params }: ProfilePageProps) {
  const resolvedParams = useParams();
  const locale = resolvedParams.locale as Locale;
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

  // 패스워드 변경 상태
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  // 권한 검증
  useEffect(() => {
    if (!loading && !storesLoading) {
      if (!user) {
        router.push(`/${locale}/login`);
        return;
      }
    }
  }, [loading, storesLoading, user, router, locale]);

  // 로딩 중인 경우
  const isLoadingPage = loading || storesLoading;

  const handleSignOut = async () => {
    await signOut();
    router.push(`/${locale}/login`);
  };

  // 현재 사용자의 프로필 정보 조회
  const {
    data: userProfile,
    isLoading: profileLoading,
    error: profileError,
  } = useQuery({
    queryKey: ["user-profile", user?.id, currentStore?.id],
    queryFn: async () => {
      if (!user || !currentStore) {
        throw new Error("User or store not found");
      }

      const response = await fetch(
        `/api/stores/${currentStore.id}/users/${user.id}`
      );
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data as UserProfile;
    },
    enabled: !!user && !!currentStore,
  });

  // 패스워드 변경
  const changePasswordMutation = useMutation({
    mutationFn: async (data: {
      currentPassword: string;
      newPassword: string;
      confirmPassword: string;
    }) => {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
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
      setIsPasswordDialogOpen(false);
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      toast({
        title: t("profile.passwordChanged", locale),
        description: t("profile.passwordChangedDescription", locale),
      });
    },
    onError: (error) => {
      toast({
        title: t("profile.passwordChangeError", locale),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handlePasswordChange = (field: string, value: string) => {
    setPasswordForm((prev) => ({ ...prev, [field]: value }));
  };

  const handlePasswordSubmit = () => {
    if (!passwordForm.currentPassword) {
      toast({
        title: t("profile.passwordChangeError", locale),
        description: t("profile.currentPasswordRequired", locale),
        variant: "destructive",
      });
      return;
    }

    if (!passwordForm.newPassword) {
      toast({
        title: t("profile.passwordChangeError", locale),
        description: t("profile.newPasswordRequired", locale),
        variant: "destructive",
      });
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast({
        title: t("profile.passwordChangeError", locale),
        description: t("profile.passwordTooShort", locale),
        variant: "destructive",
      });
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({
        title: t("profile.passwordChangeError", locale),
        description: t("profile.passwordMismatch", locale),
        variant: "destructive",
      });
      return;
    }

    changePasswordMutation.mutate(passwordForm);
  };

  const togglePasswordVisibility = (field: keyof typeof showPasswords) => {
    setShowPasswords((prev) => ({ ...prev, [field]: !prev[field] }));
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
        ) : profileError ? (
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
                프로필 정보를 불러올 수 없습니다
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
                {t("profile.myProfile", locale)}
              </h1>
              <p className="text-muted-foreground">
                {t("profile.title", locale)}
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* 프로필 정보 */}
              <div className="lg:col-span-2 space-y-6">
                {/* 개인 정보 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      {t("profile.personalInfo", locale)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-16 w-16">
                        <AvatarImage src={userProfile?.avatarUrl || ""} />
                        <AvatarFallback>
                          {userProfile?.name
                            ? userProfile.name.charAt(0).toUpperCase()
                            : "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="text-lg font-semibold">
                          {userProfile?.name || t("user.noName", locale)}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {userProfile?.email}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium">
                          {t("user.role", locale)}
                        </Label>
                        <div className="mt-1">
                          <Badge variant="outline">
                            {getRoleDisplayName(userProfile?.role || "")}
                          </Badge>
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">
                          {t("user.status", locale)}
                        </Label>
                        <div className="mt-1">
                          <Badge
                            variant={getStatusBadgeVariant(
                              userProfile?.status || ""
                            )}
                          >
                            {getStatusDisplayName(userProfile?.status || "")}
                          </Badge>
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">
                          {t("user.joinedAt", locale)}
                        </Label>
                        <p className="text-sm mt-1">
                          {userProfile?.joinedAt
                            ? formatDate(userProfile.joinedAt)
                            : "-"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 직무 역할 */}
                {userProfile?.jobRoles && userProfile.jobRoles.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>{t("user.jobRoles", locale)}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {userProfile.jobRoles.map((jobRole, index) => (
                          <Badge
                            key={`${jobRole.id}-${index}`}
                            variant="secondary"
                          >
                            {jobRole.store_job_roles.name}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* 퇴사 예정일 */}
                {userProfile?.resignationDate && (
                  <Card className="border-orange-200 bg-orange-50">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-orange-800">
                        <Calendar className="h-5 w-5" />
                        {t("user.resignationDate", locale)}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div>
                          <Label className="text-sm font-medium text-orange-700">
                            {t("user.resignationDate", locale)}
                          </Label>
                          <p className="text-lg font-semibold text-orange-900 mt-1">
                            {formatDate(userProfile.resignationDate)}
                          </p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-orange-700">
                            {t("profile.daysRemaining", locale)}
                          </Label>
                          <p className="text-sm text-orange-800 mt-1">
                            {(() => {
                              const today = new Date();
                              const resignationDate = new Date(
                                userProfile.resignationDate
                              );
                              const diffTime =
                                resignationDate.getTime() - today.getTime();
                              const diffDays = Math.ceil(
                                diffTime / (1000 * 60 * 60 * 24)
                              );

                              if (diffDays < 0) {
                                return t("profile.resignationPassed", locale);
                              } else if (diffDays === 0) {
                                return t("profile.resignationToday", locale);
                              } else if (diffDays === 1) {
                                return t("profile.resignationTomorrow", locale);
                              } else {
                                return `${diffDays}${t(
                                  "profile.daysLeft",
                                  locale
                                )}`;
                              }
                            })()}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* 근무 선호도 */}
                {userProfile?.desiredWeeklyHours && (
                  <Card>
                    <CardHeader>
                      <CardTitle>{t("user.workPreferences", locale)}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div>
                        <Label className="text-sm font-medium">
                          {t("user.desiredWeeklyHours", locale)}
                        </Label>
                        <p className="text-sm mt-1">
                          {userProfile.desiredWeeklyHours}시간
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* 계정 설정 */}
              <div className="lg:col-span-1">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Key className="h-5 w-5" />
                      {t("profile.accountInfo", locale)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Dialog
                      open={isPasswordDialogOpen}
                      onOpenChange={setIsPasswordDialogOpen}
                    >
                      <DialogTrigger asChild>
                        <Button variant="outline" className="w-full">
                          {t("profile.changePassword", locale)}
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>
                            {t("profile.changePassword", locale)}
                          </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="currentPassword">
                              {t("profile.currentPassword", locale)}
                            </Label>
                            <div className="relative">
                              <Input
                                id="currentPassword"
                                type={
                                  showPasswords.current ? "text" : "password"
                                }
                                value={passwordForm.currentPassword}
                                onChange={(e) =>
                                  handlePasswordChange(
                                    "currentPassword",
                                    e.target.value
                                  )
                                }
                                className="pr-10"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                onClick={() =>
                                  togglePasswordVisibility("current")
                                }
                              >
                                {showPasswords.current ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </div>

                          <div>
                            <Label htmlFor="newPassword">
                              {t("profile.newPassword", locale)}
                            </Label>
                            <div className="relative">
                              <Input
                                id="newPassword"
                                type={showPasswords.new ? "text" : "password"}
                                value={passwordForm.newPassword}
                                onChange={(e) =>
                                  handlePasswordChange(
                                    "newPassword",
                                    e.target.value
                                  )
                                }
                                className="pr-10"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                onClick={() => togglePasswordVisibility("new")}
                              >
                                {showPasswords.new ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </div>

                          <div>
                            <Label htmlFor="confirmPassword">
                              {t("profile.confirmPassword", locale)}
                            </Label>
                            <div className="relative">
                              <Input
                                id="confirmPassword"
                                type={
                                  showPasswords.confirm ? "text" : "password"
                                }
                                value={passwordForm.confirmPassword}
                                onChange={(e) =>
                                  handlePasswordChange(
                                    "confirmPassword",
                                    e.target.value
                                  )
                                }
                                className="pr-10"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                onClick={() =>
                                  togglePasswordVisibility("confirm")
                                }
                              >
                                {showPasswords.confirm ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              onClick={() => setIsPasswordDialogOpen(false)}
                              className="flex-1"
                            >
                              {t("profile.cancel", locale)}
                            </Button>
                            <Button
                              onClick={handlePasswordSubmit}
                              disabled={changePasswordMutation.isPending}
                              className="flex-1"
                            >
                              {changePasswordMutation.isPending
                                ? t("dashboard.loading", locale)
                                : t("profile.saveChanges", locale)}
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
