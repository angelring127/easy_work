"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { t } from "@/lib/i18n";
import { Locale } from "@/lib/i18n-config";
import { Invitation, CreateInvitationRequest } from "@/lib/supabase/types";
import { useStore } from "@/contexts/store-context";

interface InvitationManagerProps {
  storeId: string;
  locale: Locale;
}

interface ImportCandidate {
  importId: string;
  userId: string | null;
  storeUserId: string | null;
  isGuest: boolean;
  name: string;
  email: string;
  sourceRole: string | null;
}

export function InvitationManager({ storeId, locale }: InvitationManagerProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [inviteMode, setInviteMode] = useState<"email" | "guest" | "import">(
    "email"
  );
  const [createForm, setCreateForm] = useState<{
    email: string;
    name: string;
    roleHint: "PART_TIMER" | "SUB_MANAGER";
    expiresInDays: number;
  }>({
    email: "",
    name: "",
    roleHint: "PART_TIMER",
    expiresInDays: 7,
  });
  const [selectedSourceStoreId, setSelectedSourceStoreId] = useState("");
  const [selectedImportIds, setSelectedImportIds] = useState<string[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { accessibleStores } = useStore();

  const manageableSourceStores = useMemo(
    () =>
      accessibleStores.filter(
        (store) =>
          store.id !== storeId &&
          ["MASTER", "SUB_MANAGER", "SUB"].includes(store.user_role || "")
      ),
    [accessibleStores, storeId]
  );

  useEffect(() => {
    if (
      manageableSourceStores.length > 0 &&
      (!selectedSourceStoreId ||
        !manageableSourceStores.some((store) => store.id === selectedSourceStoreId))
    ) {
      setSelectedSourceStoreId(manageableSourceStores[0].id);
    }
  }, [manageableSourceStores, selectedSourceStoreId]);

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
    gcTime: 0, // v5: 캐시 정리 시간 (기존 cacheTime 대체)
  });

  const importCandidatesQuery = useQuery({
    queryKey: ["import-candidates", storeId, selectedSourceStoreId],
    enabled:
      isCreateDialogOpen &&
      inviteMode === "import" &&
      Boolean(selectedSourceStoreId),
    queryFn: async () => {
      const response = await fetch(
        `/api/stores/${storeId}/users/import-candidates?source_store_id=${selectedSourceStoreId}`
      );
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data as {
        store: { id: string; name: string };
        candidates: ImportCandidate[];
      };
    },
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
      setInviteMode("email");
      setSelectedImportIds([]);
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

  const importUsersMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/stores/${storeId}/users/import`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourceStoreId: selectedSourceStoreId,
          candidates: (importCandidatesQuery.data?.candidates || [])
            .filter((candidate) => selectedImportIds.includes(candidate.importId))
            .map((candidate) => ({
              userId: candidate.userId,
              sourceStoreUserId: candidate.storeUserId,
              isGuest: candidate.isGuest,
            })),
          role: createForm.roleHint,
        }),
      });
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data as {
        imported: Array<{ userId: string; storeUserId?: string }>;
        skipped: Array<{ userId: string; reason: string }>;
        alreadyExists: Array<{ userId: string }>;
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["store-users", storeId] });
      setSelectedImportIds([]);
      setIsCreateDialogOpen(false);

      const summary = [
        `${t("invite.importResultImported", locale)}: ${data.imported.length}`,
        `${t("invite.importResultAlreadyExists", locale)}: ${data.alreadyExists.length}`,
        `${t("invite.importResultSkipped", locale)}: ${data.skipped.length}`,
      ].join(" / ");

      toast({
        title: t("invite.importSuccess", locale),
        description: summary,
      });
    },
    onError: (error) => {
      toast({
        title: t("invite.importError", locale),
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
    if (inviteMode === "import") {
      if (!selectedSourceStoreId || selectedImportIds.length === 0) {
        toast({
          title: t("invite.importSelectionRequired", locale),
          variant: "destructive",
        });
        return;
      }

      importUsersMutation.mutate();
      return;
    }

    // 게스트 사용자 등록인 경우
    if (inviteMode === "guest") {
      if (!createForm.name) {
        toast({
          title: t("invite.setupPassword.nameRequiredTitle", locale),
          variant: "destructive",
        });
        return;
      }

      createInvitationMutation.mutate({
        storeId,
        name: createForm.name,
        roleHint: createForm.roleHint,
        isGuest: true,
      });
      return;
    }

    // 일반 이메일 초대인 경우
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
      name: createForm.name,
      roleHint: createForm.roleHint,
      expiresInDays: createForm.expiresInDays,
      isGuest: false,
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
              <Tabs
                value={inviteMode}
                onValueChange={(value) => {
                  setInviteMode(value as "email" | "guest" | "import");
                  setSelectedImportIds([]);
                }}
              >
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="email">
                    {t("invite.mode.email", locale)}
                  </TabsTrigger>
                  <TabsTrigger value="guest">
                    {t("invite.mode.guest", locale)}
                  </TabsTrigger>
                  <TabsTrigger value="import">
                    {t("invite.mode.import", locale)}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              {inviteMode !== "import" && (
                <>
                  <div>
                    <Label htmlFor="name">
                      {t("invite.name", locale)}
                      {inviteMode === "guest" && (
                        <span className="text-red-500 ml-1">*</span>
                      )}
                    </Label>
                    <Input
                      id="name"
                      type="text"
                      value={createForm.name}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, name: e.target.value })
                      }
                      placeholder={t("invite.namePlaceholder", locale)}
                      required={inviteMode === "guest"}
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">
                      {t("invite.email", locale)}
                      {inviteMode === "email" && (
                        <span className="text-red-500 ml-1">*</span>
                      )}
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={createForm.email}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, email: e.target.value })
                      }
                      placeholder={t("invite.emailPlaceholder", locale)}
                      disabled={inviteMode !== "email"}
                      required={inviteMode === "email"}
                    />
                    {inviteMode === "guest" && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {t("invite.guestNoEmailDescription", locale)}
                      </p>
                    )}
                  </div>
                </>
              )}
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
              {inviteMode === "email" && (
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
              )}
              {inviteMode === "import" && (
                <div className="space-y-4 rounded-md border p-4">
                  <div className="space-y-2">
                    <Label>{t("invite.importSourceStore", locale)}</Label>
                    {manageableSourceStores.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {t("invite.importNoSourceStores", locale)}
                      </p>
                    ) : (
                      <Tabs
                        value={selectedSourceStoreId}
                        onValueChange={(value) => {
                          setSelectedSourceStoreId(value);
                          setSelectedImportIds([]);
                        }}
                      >
                        <TabsList className="flex h-auto flex-wrap justify-start gap-2 bg-transparent p-0">
                          {manageableSourceStores.map((store) => (
                            <TabsTrigger
                              key={store.id}
                              value={store.id}
                              className="border"
                            >
                              {store.name}
                            </TabsTrigger>
                          ))}
                        </TabsList>
                      </Tabs>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>{t("invite.importCandidates", locale)}</Label>
                    {importCandidatesQuery.isLoading ? (
                      <p className="text-sm text-muted-foreground">
                        {t("dashboard.loading", locale)}
                      </p>
                    ) : importCandidatesQuery.isError ? (
                      <p className="text-sm text-destructive">
                        {t("invite.importLoadError", locale)}
                      </p>
                    ) : importCandidatesQuery.data?.candidates?.length ? (
                      <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border p-2">
                        {importCandidatesQuery.data.candidates.map((candidate) => (
                          <label
                            key={candidate.importId}
                            className="flex cursor-pointer items-start gap-3 rounded-md border p-3"
                          >
                            <Checkbox
                              checked={selectedImportIds.includes(candidate.importId)}
                              onCheckedChange={(checked) => {
                                setSelectedImportIds((prev) =>
                                  checked === true
                                    ? [...prev, candidate.importId]
                                    : prev.filter((id) => id !== candidate.importId)
                                );
                              }}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 font-medium">
                                <span>{candidate.name}</span>
                                {candidate.isGuest && (
                                  <Badge variant="secondary">
                                    {t("user.guest", locale)}
                                  </Badge>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {candidate.email || "-"}
                              </div>
                              {candidate.sourceRole && (
                                <div className="text-xs text-muted-foreground">
                                  {t("invite.importSourceRole", locale)}:{" "}
                                  {getRoleDisplayName(candidate.sourceRole)}
                                </div>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {t("invite.importEmpty", locale)}
                      </p>
                    )}
                  </div>
                </div>
              )}
              <Button
                onClick={handleCreateInvitation}
                disabled={
                  createInvitationMutation.isPending || importUsersMutation.isPending
                }
                className="w-full"
              >
                {createInvitationMutation.isPending || importUsersMutation.isPending
                  ? t("dashboard.loading", locale)
                  : inviteMode === "import"
                  ? t("invite.importSubmit", locale)
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
              {t("invite.refresh", locale)}
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
                          variant={
                            getStatusBadgeVariant(invitation.status) as
                              | "default"
                              | "secondary"
                              | "destructive"
                              | "outline"
                          }
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
