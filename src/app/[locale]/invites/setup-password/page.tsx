"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t } from "@/lib/i18n";

export default function SetupPasswordPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [invitationInfo, setInvitationInfo] = useState<any>(null);

  const locale = params.locale as string;
  const token = searchParams.get("token");

  useEffect(() => {
    const checkUserAndInvitation = async () => {
      try {
        const supabase = createClient();

        // 현재 사용자 정보 가져오기
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser();

        if (!currentUser) {
          toast({
            title: "인증 오류",
            description: "로그인이 필요합니다.",
            variant: "destructive",
          });
          router.push(`/${locale}/login`);
          return;
        }

        setUser(currentUser);

        // 초대 정보 가져오기
        if (token) {
          const response = await fetch(`/api/invitations/info?token=${token}`);
          const result = await response.json();

          if (result.success) {
            setInvitationInfo(result.data);
          } else {
            toast({
              title: "초대 오류",
              description: result.error,
              variant: "destructive",
            });
            router.push(`/${locale}/invites/error`);
          }
        }
      } catch (error) {
        console.error("사용자 및 초대 정보 확인 실패:", error);
        toast({
          title: "오류 발생",
          description: "정보를 불러오는 중 오류가 발생했습니다.",
          variant: "destructive",
        });
      }
    };

    checkUserAndInvitation();
  }, [token, locale, router, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({
        title: "패스워드가 일치하지 않습니다",
        description: "패스워드를 다시 확인해주세요.",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 8) {
      toast({
        title: "패스워드가 너무 짧습니다",
        description: "최소 8자 이상 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();

      // 패스워드 업데이트
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        throw updateError;
      }

      // 초대 수락 처리
      if (token) {
        const requestBody = {
          tokenHash: token,
          name:
            user.user_metadata?.name || user.email?.split("@")[0] || "사용자",
          password: password,
        };

        console.log("초대 수락 API 요청:", {
          tokenHash: token,
          name: requestBody.name,
          passwordLength: password.length,
        });

        const response = await fetch("/api/invitations/accept", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        });

        const result = await response.json();
        console.log("초대 수락 API 응답:", result);

        if (!result.success) {
          throw new Error(result.error);
        }

        // 초대 수락 성공 후 세션 새로고침
        const supabase = createClient();
        await supabase.auth.refreshSession();
      }

      toast({
        title: "패스워드 설정 완료",
        description: "초대가 성공적으로 수락되었습니다.",
      });

      // 대시보드로 이동
      router.push(`/${locale}/dashboard`);
    } catch (error: any) {
      console.error("패스워드 설정 실패:", error);
      toast({
        title: "패스워드 설정에 실패했습니다",
        description: error.message || "오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!user || !invitationInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>로딩 중...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>패스워드 설정</CardTitle>
          <CardDescription>
            {invitationInfo.store?.name || "알 수 없는 매장"} 매장 초대를
            수락하기 위해 패스워드를 설정해주세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">이메일</Label>
              <Input
                id="email"
                type="email"
                value={user.email}
                disabled
                className="bg-gray-50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">새 패스워드</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="최소 8자 이상"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">패스워드 확인</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="패스워드를 다시 입력하세요"
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "처리 중..." : "패스워드 설정 및 초대 수락"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
