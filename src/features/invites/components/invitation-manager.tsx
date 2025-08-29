"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Invitation, CreateInvitationRequest } from "@/lib/supabase/types";

interface InvitationManagerProps {
  storeId: string;
  locale: Locale;
}

export function InvitationManager({ storeId, locale }: InvitationManagerProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: "",
    name: "",
    roleHint: "PART_TIMER" as const,
    expiresInDays: 7,
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 초대 목록 조회
  const {
    data: invitationsData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["invitations", storeId],
    queryFn: async () => {
      console.log("초대 목록 조회 중...", { storeId });
      const response = await fetch(`/api/invitations?storeId=${storeId}`);
      const result = await response.json();
      console.log("초대 목록 응답:", result);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    refetchOnWindowFocus: true, // 윈도우 포커스 시 새로고침
    refetchInterval: 2000, // 2초마다 자동 새로고침 (더 빠른 업데이트)
    staleTime: 0, // 항상 최신 데이터 가져오기
    cacheTime: 0, // 캐시 시간을 0으로 설정하여 항상 새로고침
  });

  // 초대 생성
  const createInvitationMutation = useMutation({
    mutationFn: async (data: CreateInvitationRequest) => {
      const response = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitations", storeId] });
      setIsCreateDialogOpen(false);
      setCreateForm({
        email: "",
        name: "",
        roleHint: "PART_TIMER",
        expiresInDays: 7,
      });
      toast({
        title: t("invite.createSuccess", locale),
        description: t("invite.createSuccess", locale),
      });
    },
    onError: (error) => {
      toast({
        title: t("invite.createError", locale),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // 초대 재발송
  const resendInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const response = await fetch(`/api/invitations/${invitationId}/resend`, {
        method: "POST",
      });
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitations", storeId] });
      toast({
        title: t("invite.resendSuccess", locale),
        description: t("invite.resendSuccess", locale),
      });
    },
    onError: (error) => {
      toast({
        title: t("invite.resendError", locale),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // 초대 취소
  const cancelInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      console.log("초대 취소 요청:", { invitationId });
      const response = await fetch(`/api/invitations/${invitationId}/cancel`, {
        method: "POST",
      });
      const result = await response.json();
      console.log("초대 취소 응답:", result);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    onSuccess: () => {
      console.log("초대 취소 성공, 캐시 무효화 시작");

      // 모든 초대 관련 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ["invitations"] });
      queryClient.invalidateQueries({ queryKey: ["invitations", storeId] });

      // 즉시 리페치
      setTimeout(() => {
        console.log("초대 목록 리페치 시작");
        refetch();
      }, 50);

      toast({
        title: t("invite.cancelSuccess", locale),
        description: t("invite.cancelSuccess", locale),
      });
    },
    onError: (error) => {
      toast({
        title: t("invite.cancelError", locale),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateInvitation = () => {
    if (!createForm.email) {
      toast({
        title: t("invite.emailRequired", locale),
        variant: "destructive",
      });
      return;
    }

    createInvitationMutation.mutate({
      storeId,
      email: createForm.email,
      roleHint: createForm.roleHint,
      expiresInDays: createForm.expiresInDays,
    });
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "PENDING":
        return "default";
      case "ACCEPTED":
        return "success";
      case "EXPIRED":
        return "destructive";
      case "CANCELLED":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case "PART_TIMER":
        return t("invite.partTimer", locale);
      case "SUB_MANAGER":
        return t("invite.subManager", locale);
      default:
        return role;
    }
  };

  const getStatusDisplayName = (status: string) => {
    switch (status) {
      case "PENDING":
        return t("invite.pending", locale);
      case "ACCEPTED":
        return t("invite.accepted", locale);
      case "EXPIRED":
        return t("invite.expired", locale);
      case "CANCELLED":
        return t("invite.cancelled", locale);
      default:
        return status;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">{t("invite.title", locale)}</h2>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>{t("invite.create", locale)}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("invite.create", locale)}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">{t("invite.name", locale)}</Label>
                <Input
                  id="name"
                  type="text"
                  value={createForm.name}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, name: e.target.value })
                  }
                  placeholder="홍길동"
                />
              </div>
              <div>
                <Label htmlFor="email">{t("invite.email", locale)}</Label>
                <Input
                  id="email"
                  type="email"
                  value={createForm.email}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, email: e.target.value })
                  }
                  placeholder="example@email.com"
                />
              </div>
              <div>
                <Label htmlFor="role">{t("invite.role", locale)}</Label>
                <Select
                  value={createForm.roleHint}
                  onValueChange={(value) =>
                    setCreateForm({
                      ...createForm,
                      roleHint: value as "PART_TIMER" | "SUB_MANAGER",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PART_TIMER">
                      {t("invite.partTimer", locale)}
                    </SelectItem>
                    <SelectItem value="SUB_MANAGER">
                      {t("invite.subManager", locale)}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="expiresIn">
                  {t("invite.expiresIn", locale)}
                </Label>
                <Select
                  value={createForm.expiresInDays.toString()}
                  onValueChange={(value) =>
                    setCreateForm({
                      ...createForm,
                      expiresInDays: parseInt(value),
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">
                      1 {t("invite.days", locale)}
                    </SelectItem>
                    <SelectItem value="3">
                      3 {t("invite.days", locale)}
                    </SelectItem>
                    <SelectItem value="7">
                      7 {t("invite.days", locale)}
                    </SelectItem>
                    <SelectItem value="14">
                      14 {t("invite.days", locale)}
                    </SelectItem>
                    <SelectItem value="30">
                      30 {t("invite.days", locale)}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleCreateInvitation}
                disabled={createInvitationMutation.isPending}
                className="w-full"
              >
                {createInvitationMutation.isPending
                  ? t("dashboard.loading", locale)
                  : t("invite.create", locale)}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>{t("invite.list", locale)}</CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                console.log("수동 리페치 버튼 클릭");
                refetch();
              }}
            >
              새로고침
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              {t("dashboard.loading", locale)}
            </div>
          ) : invitationsData?.invitations?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t("user.noMembers", locale)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("invite.email", locale)}</TableHead>
                  <TableHead>{t("invite.role", locale)}</TableHead>
                  <TableHead>{t("invite.status", locale)}</TableHead>
                  <TableHead>{t("invite.expiresIn", locale)}</TableHead>
                  <TableHead>{t("invite.actions", locale)}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitationsData?.invitations?.map((invitation: Invitation) => {
                  console.log("초대 렌더링:", {
                    id: invitation.id,
                    email: invitation.invited_email,
                    status: invitation.status,
                    displayStatus: getStatusDisplayName(invitation.status),
                  });
                  return (
                    <TableRow key={invitation.id}>
                      <TableCell>{invitation.invited_email}</TableCell>
                      <TableCell>
                        {getRoleDisplayName(invitation.role_hint)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={getStatusBadgeVariant(invitation.status)}
                        >
                          {getStatusDisplayName(invitation.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(invitation.expires_at)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {invitation.status === "PENDING" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  resendInvitationMutation.mutate(invitation.id)
                                }
                                disabled={resendInvitationMutation.isPending}
                              >
                                {t("invite.resend", locale)}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() =>
                                  cancelInvitationMutation.mutate(invitation.id)
                                }
                                disabled={cancelInvitationMutation.isPending}
                              >
                                {t("invite.cancel", locale)}
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
