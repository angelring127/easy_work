"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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

  // 사용자 목록 조회
  const { data: usersData, isLoading } = useQuery({
    queryKey: ["store-users", storeId, filters],
    queryFn: async () => {
      const response = await fetch(`/api/stores/${storeId}/users`);
      const result = await response.json();
      console.log("API 응답:", result);
      return result.data;
    },
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

  // 역할 회수
  const revokeRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const response = await fetch(`/api/stores/${storeId}/roles/revoke`, {
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
        title: t("user.roleRevoked", locale),
        description: t("user.roleRevokedDescription", locale),
      });
    },
    onError: (error) => {
      toast({
        title: t("user.roleRevokeError", locale),
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

  const handleRevokeRole = (userId: string, role: string) => {
    revokeRoleMutation.mutate({ userId, role });
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
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">
          {t("user.managementForStore", locale, { storeName: "매장" })}
        </h1>
        <p className="text-muted-foreground">{t("user.management", locale)}</p>
      </div>

      <Tabs defaultValue="members" className="space-y-6">
        <TabsList>
          <TabsTrigger value="members">{t("user.members", locale)}</TabsTrigger>
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
                    onValueChange={(value) => handleFilterChange("role", value)}
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
                      setFilters({ role: "all", status: "all", search: "" })
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
                      {usersData.pagination.total} {t("user.total", locale)}
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
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
                      <TableRow key={member.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarImage src={member.avatar_url || ""} />
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
                                <Badge variant="outline" className="text-xs">
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
                          <Badge variant={getStatusBadgeVariant(member.status)}>
                            {getStatusDisplayName(member.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(member.granted_at)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {member.role === "PART_TIMER" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  handleGrantRole(member.user_id, "SUB_MANAGER")
                                }
                                disabled={grantRoleMutation.isPending}
                              >
                                {t("store.role.sub_manager", locale)} 승격
                              </Button>
                            )}
                            {member.role === "SUB_MANAGER" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  handleRevokeRole(
                                    member.user_id,
                                    "SUB_MANAGER"
                                  )
                                }
                                disabled={revokeRoleMutation.isPending}
                              >
                                {t("store.role.sub_manager", locale)} 회수
                              </Button>
                            )}
                            <Dialog
                              open={isTemporaryAssignDialogOpen}
                              onOpenChange={setIsTemporaryAssignDialogOpen}
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
                                    <Label>{t("user.startDate", locale)}</Label>
                                    <Input
                                      type="date"
                                      value={temporaryAssignForm.startDate}
                                      onChange={(e) =>
                                        setTemporaryAssignForm((prev) => ({
                                          ...prev,
                                          startDate: e.target.value,
                                        }))
                                      }
                                    />
                                  </div>
                                  <div>
                                    <Label>{t("user.endDate", locale)}</Label>
                                    <Input
                                      type="date"
                                      value={temporaryAssignForm.endDate}
                                      onChange={(e) =>
                                        setTemporaryAssignForm((prev) => ({
                                          ...prev,
                                          endDate: e.target.value,
                                        }))
                                      }
                                    />
                                  </div>
                                  <div>
                                    <Label>{t("user.reason", locale)}</Label>
                                    <Textarea
                                      placeholder={t(
                                        "user.reasonPlaceholder",
                                        locale
                                      )}
                                      value={temporaryAssignForm.reason}
                                      onChange={(e) =>
                                        setTemporaryAssignForm((prev) => ({
                                          ...prev,
                                          reason: e.target.value,
                                        }))
                                      }
                                    />
                                  </div>
                                  <Button
                                    onClick={handleTemporaryAssign}
                                    disabled={temporaryAssignMutation.isPending}
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
    </div>
  );
}
