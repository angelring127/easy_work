"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { t } from "@/lib/i18n";
import {
  Mail,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  Trash2,
  Copy,
  Shield,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

interface Invite {
  id: string;
  email: string;
  role: "SUB_MANAGER" | "PART_TIMER";
  token: string;
  invited_at: string;
  expires_at: string;
  accepted_at?: string;
  is_used: boolean;
  is_cancelled: boolean;
  store: {
    id: string;
    name: string;
  };
  invited_by_user?: {
    email: string;
  };
  accepted_by_user?: {
    email: string;
  };
}

interface InvitesListProps {
  storeId: string;
  onInviteUpdate?: () => void;
  className?: string;
}

/**
 * 초대 목록 컴포넌트
 */
export function InvitesList({
  storeId,
  onInviteUpdate,
  className,
}: InvitesListProps) {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const { toast } = useToast();

  /**
   * 초대 목록 로드
   */
  const loadInvites = async () => {
    setIsLoading(true);

    try {
      const response = await fetch(`/api/invites?store_id=${storeId}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "초대 목록 로드에 실패했습니다");
      }

      setInvites(result.data || []);
    } catch (error) {
      console.error("초대 목록 로드 오류:", error);
      toast({
        title: "로드 실패",
        description:
          error instanceof Error
            ? error.message
            : "알 수 없는 오류가 발생했습니다",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 초대 취소
   */
  const handleCancelInvite = async (inviteId: string) => {
    setCancellingId(inviteId);

    try {
      const response = await fetch(`/api/invites/${inviteId}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "초대 취소에 실패했습니다");
      }

      toast({
        title: "초대 취소 완료",
        description: "초대가 성공적으로 취소되었습니다",
      });

      // 목록 새로고침
      await loadInvites();
      onInviteUpdate?.();
    } catch (error) {
      console.error("초대 취소 오류:", error);
      toast({
        title: "취소 실패",
        description:
          error instanceof Error
            ? error.message
            : "알 수 없는 오류가 발생했습니다",
        variant: "destructive",
      });
    } finally {
      setCancellingId(null);
    }
  };

  /**
   * 초대 링크 복사
   */
  const handleCopyInviteLink = async (token: string) => {
    const inviteUrl = `${window.location.origin}/ko/invites/accept/${token}`;

    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast({
        title: "링크 복사됨",
        description: "초대 링크가 클립보드에 복사되었습니다",
      });
    } catch (error) {
      console.error("링크 복사 오류:", error);
      toast({
        title: "복사 실패",
        description: "링크 복사에 실패했습니다",
        variant: "destructive",
      });
    }
  };

  /**
   * 초대 상태 계산
   */
  const getInviteStatus = (invite: Invite) => {
    const now = new Date();
    const expiresAt = new Date(invite.expires_at);
    const isExpired = now > expiresAt;

    if (invite.is_cancelled) {
      return {
        status: "cancelled",
        label: "취소됨",
        variant: "secondary" as const,
      };
    }

    if (invite.is_used && invite.accepted_at) {
      return {
        status: "accepted",
        label: "수락됨",
        variant: "default" as const,
      };
    }

    if (isExpired) {
      return {
        status: "expired",
        label: "만료됨",
        variant: "destructive" as const,
      };
    }

    return { status: "pending", label: "대기중", variant: "outline" as const };
  };

  /**
   * 역할 표시
   */
  const getRoleDisplay = (role: string) => {
    switch (role) {
      case "SUB_MANAGER":
        return { label: "서브 관리자", variant: "default" as const };
      case "PART_TIMER":
        return { label: "파트타이머", variant: "secondary" as const };
      default:
        return { label: role, variant: "outline" as const };
    }
  };

  /**
   * 컴포넌트 마운트 시 초대 목록 로드
   */
  useEffect(() => {
    if (storeId) {
      loadInvites();
    }
  }, [storeId]);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          {t("invites.list.title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              <span>초대 목록을 불러오는 중...</span>
            </div>
          </div>
        ) : invites.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Mail className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-muted-foreground">아직 초대가 없습니다</p>
            <p className="text-sm text-muted-foreground">
              새 팀원을 초대해보세요
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이메일</TableHead>
                  <TableHead>역할</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>초대일</TableHead>
                  <TableHead>만료일</TableHead>
                  <TableHead className="text-right">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.map((invite) => {
                  const status = getInviteStatus(invite);
                  const roleDisplay = getRoleDisplay(invite.role);

                  return (
                    <TableRow key={invite.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{invite.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={roleDisplay.variant}
                          className="flex items-center gap-1 w-fit"
                        >
                          <Shield className="h-3 w-3" />
                          {roleDisplay.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={status.variant}
                          className="flex items-center gap-1 w-fit"
                        >
                          {status.status === "accepted" && (
                            <CheckCircle className="h-3 w-3" />
                          )}
                          {status.status === "cancelled" && (
                            <XCircle className="h-3 w-3" />
                          )}
                          {status.status === "expired" && (
                            <AlertCircle className="h-3 w-3" />
                          )}
                          {status.status === "pending" && (
                            <Clock className="h-3 w-3" />
                          )}
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(invite.invited_at), "MM/dd HH:mm", {
                            locale: ko,
                          })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {format(new Date(invite.expires_at), "MM/dd HH:mm", {
                            locale: ko,
                          })}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {status.status === "pending" && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  handleCopyInviteLink(invite.token)
                                }
                                className="h-8 w-8 p-0"
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCancelInvite(invite.id)}
                                disabled={cancellingId === invite.id}
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              >
                                {cancellingId === invite.id ? (
                                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}
