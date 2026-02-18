"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
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
import { defaultLocale } from "@/lib/i18n-config";
import { t, type Locale } from "@/lib/i18n";
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
import { enUS, ja, ko } from "date-fns/locale";

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
  const params = useParams();
  const locale = (params?.locale as Locale) || defaultLocale;

  /**
   * 초대 목록 로드
   */
  const loadInvites = async () => {
    setIsLoading(true);

    try {
      const response = await fetch(`/api/invites?store_id=${storeId}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || t("invite.loadError", locale));
      }

      setInvites(result.data || []);
    } catch (error) {
      console.error("초대 목록 로드 오류:", error);
      toast({
        title: t("invite.loadError", locale),
        description:
          error instanceof Error
            ? error.message
            : t("common.unknownError", locale),
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
        throw new Error(result.error || t("invite.cancelError", locale));
      }

      toast({
        title: t("invite.cancelSuccess", locale),
        description: t("invite.cancelSuccess", locale),
      });

      // 목록 새로고침
      await loadInvites();
      onInviteUpdate?.();
    } catch (error) {
      console.error("초대 취소 오류:", error);
      toast({
        title: t("invite.cancelError", locale),
        description:
          error instanceof Error
            ? error.message
            : t("common.unknownError", locale),
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
    const inviteUrl = `${window.location.origin}/${locale}/invites/accept/${token}`;

    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast({
        title: t("invite.linkCopied", locale),
        description: t("invite.linkCopiedDescription", locale),
      });
    } catch (error) {
      console.error("링크 복사 오류:", error);
      toast({
        title: t("invite.copyError", locale),
        description: t("invite.copyError", locale),
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
        label: t("invite.cancelled", locale),
        variant: "secondary" as const,
      };
    }

    if (invite.is_used && invite.accepted_at) {
      return {
        status: "accepted",
        label: t("invite.accepted", locale),
        variant: "default" as const,
      };
    }

    if (isExpired) {
      return {
        status: "expired",
        label: t("invite.expired", locale),
        variant: "destructive" as const,
      };
    }

    return {
      status: "pending",
      label: t("invite.pending", locale),
      variant: "outline" as const,
    };
  };

  /**
   * 역할 표시
   */
  const getRoleDisplay = (role: string) => {
    switch (role) {
      case "SUB_MANAGER":
        return { label: t("invite.subManager", locale), variant: "default" as const };
      case "PART_TIMER":
        return { label: t("invite.partTimer", locale), variant: "secondary" as const };
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
          {t("invites.list.title", locale)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              <span>{t("invite.accept.loading", locale)}</span>
            </div>
          </div>
        ) : invites.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Mail className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-muted-foreground">{t("invite.empty", locale)}</p>
            <p className="text-sm text-muted-foreground">
              {t("invite.emptyDescription", locale)}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("invite.email", locale)}</TableHead>
                  <TableHead>{t("invite.role", locale)}</TableHead>
                  <TableHead>{t("invite.status", locale)}</TableHead>
                  <TableHead>{t("invite.invitedAt", locale)}</TableHead>
                  <TableHead>{t("invite.expiresAt", locale)}</TableHead>
                  <TableHead className="text-right">{t("invite.actions", locale)}</TableHead>
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
                            locale: locale === "ko" ? ko : locale === "ja" ? ja : enUS,
                          })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {format(new Date(invite.expires_at), "MM/dd HH:mm", {
                            locale: locale === "ko" ? ko : locale === "ja" ? ja : enUS,
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
