"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { t } from "@/lib/i18n";
import { Locale } from "@/lib/i18n-config";

interface AcceptInvitationPageProps {
  params: Promise<{
    locale: string;
    token: string;
  }>;
}

export default function AcceptInvitationPage({
  params,
}: AcceptInvitationPageProps) {
  const resolvedParams = useParams();
  const locale = resolvedParams.locale as Locale;
  const token = resolvedParams.token as string;
  const router = useRouter();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    password: "",
    confirmPassword: "",
  });
  const [invitationInfo, setInvitationInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 초대 정보 조회
  useEffect(() => {
    const fetchInvitationInfo = async () => {
      try {
        // 실제 구현에서는 토큰으로 초대 정보를 조회하는 API가 필요
        // 현재는 임시로 토큰을 표시
        setInvitationInfo({
          token,
          storeName: "Sample Store",
          role: "PART_TIMER",
          expiresAt: new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000
          ).toISOString(),
        });
      } catch (error) {
        console.error("초대 정보 조회 실패:", error);
        toast({
          title: t("invite.invalidToken", locale),
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchInvitationInfo();
  }, [token, locale, toast]);

  // 초대 수락 (회원가입 + 매장 추가)
  const acceptInvitationMutation = useMutation({
    mutationFn: async (data: {
      tokenHash: string;
      name: string;
      password: string;
    }) => {
      const response = await fetch("/api/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenHash: data.tokenHash,
          name: data.name,
          password: data.password,
        }),
      });
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    onSuccess: (data) => {
      toast({
        title: t("invite.acceptSuccess", locale),
        description: t("invite.acceptSuccess", locale),
      });
      // 대시보드로 리다이렉트
      router.push(`/${locale}/dashboard`);
    },
    onError: (error) => {
      toast({
        title: t("invite.acceptError", locale),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast({
        title: t("auth.signup.nameRequired", locale),
        variant: "destructive",
      });
      return;
    }

    if (formData.password.length < 6) {
      toast({
        title: t("auth.signup.passwordMinLength", locale),
        variant: "destructive",
      });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast({
        title: t("auth.signup.passwordMismatch", locale),
        variant: "destructive",
      });
      return;
    }

    acceptInvitationMutation.mutate({
      tokenHash: token,
      name: formData.name,
      password: formData.password,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>{t("dashboard.loading", locale)}</p>
        </div>
      </div>
    );
  }

  if (!invitationInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-destructive">
              {t("invite.invalidToken", locale)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center text-muted-foreground mb-4">
              {t("invite.invalidToken", locale)}
            </p>
            <Button
              onClick={() => router.push(`/${locale}/login`)}
              className="w-full"
            >
              {t("auth.login.title", locale)}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">
            {t("invite.accept", locale)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-6 p-4 bg-muted rounded-lg">
            <h3 className="font-semibold mb-2">
              {t("invite.body.welcome", locale)}
            </h3>
            <p className="text-sm text-muted-foreground mb-2">
              {t("invite.body.invited", locale)}
            </p>
            <div className="space-y-1 text-sm">
              <p>
                <strong>{t("invite.body.storeName", locale)}:</strong>{" "}
                {invitationInfo.storeName}
              </p>
              <p>
                <strong>{t("invite.body.role", locale)}:</strong>{" "}
                {invitationInfo.role}
              </p>
              <p>
                <strong>{t("invite.body.expiresAt", locale)}:</strong>{" "}
                {new Date(invitationInfo.expiresAt).toLocaleDateString(locale)}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">{t("auth.signup.name", locale)}</Label>
              <Input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder={t("auth.signup.namePlaceholder", locale)}
                required
              />
            </div>
            <div>
              <Label htmlFor="password">
                {t("auth.signup.password", locale)}
              </Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                placeholder={t("auth.signup.passwordPlaceholder", locale)}
                required
              />
            </div>
            <div>
              <Label htmlFor="confirmPassword">
                {t("auth.signup.confirmPassword", locale)}
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) =>
                  setFormData({ ...formData, confirmPassword: e.target.value })
                }
                placeholder={t(
                  "auth.signup.confirmPasswordPlaceholder",
                  locale
                )}
                required
              />
            </div>
            <Button
              type="submit"
              disabled={acceptInvitationMutation.isPending}
              className="w-full"
            >
              {acceptInvitationMutation.isPending
                ? t("dashboard.loading", locale)
                : t("invite.accept", locale)}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <p className="text-xs text-muted-foreground">
              {t("invite.body.footer", locale)}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
