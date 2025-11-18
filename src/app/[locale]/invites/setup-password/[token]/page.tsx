"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { t } from "@/lib/i18n";

export default function SetupPasswordPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [invitationInfo, setInvitationInfo] = useState<any>(null);
  const [user, setUser] = useState<any>(null);

  const token = params.token as string;
  const locale = params.locale as string;

  console.log("=== /invites/setup-password/[token]/page.tsx 로드됨 (경로 파라미터 버전) ===");
  console.log("페이지 파라미터:", {
    locale,
    token,
    fullUrl: typeof window !== "undefined" ? window.location.href : "SSR",
  });

  useEffect(() => {
    const checkUser = async () => {
      console.log("[token]/page.tsx - checkUser 시작");
      const supabase = createClient();

      // URL 해시 확인 및 처리
      const hash = window.location.hash;
      console.log("SetupPasswordPage: URL 해시 확인", {
        hash: hash.substring(0, 100) + "...",
        fullUrl: window.location.href,
      });

      if (hash && hash.includes("access_token")) {
        const urlParams = new URLSearchParams(hash.substring(1));
        const accessToken = urlParams.get("access_token");
        const type = urlParams.get("type");

        console.log("SetupPasswordPage: URL 해시에서 토큰 확인", {
          accessToken: !!accessToken,
          type,
        });

        if (accessToken && type === "invite") {
          // 토큰으로 세션 설정
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: urlParams.get("refresh_token") || "",
          });

          if (sessionError) {
            console.error("SetupPasswordPage: 세션 설정 실패", sessionError);
            toast({
              title: "인증 오류",
              description: "초대 링크 처리 중 오류가 발생했습니다.",
              variant: "destructive",
            });
            return;
          }

          if (data.user) {
            console.log("SetupPasswordPage: 세션 설정 성공", data.user.email);
            setUser(data.user);
          }
        }
      }

      // 사용자 정보 확인
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error) {
          console.error("사용자 정보 조회 실패:", error);

          // AuthSessionMissingError인 경우 특별 처리
          if (error.message.includes("Auth session missing")) {
            console.log("세션이 없음, 초대 토큰으로 세션 설정 시도");

            // URL 해시에서 access_token 확인
            const hash = window.location.hash;
            if (hash && hash.includes("access_token")) {
              const urlParams = new URLSearchParams(hash.substring(1));
              const accessToken = urlParams.get("access_token");
              const type = urlParams.get("type");

              console.log("URL 해시에서 토큰 확인:", {
                accessToken: !!accessToken,
                type,
              });

              if (accessToken && type === "invite") {
                // 토큰으로 세션 설정
                const { data, error: sessionError } =
                  await supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: urlParams.get("refresh_token") || "",
                  });

                if (sessionError) {
                  console.error("세션 설정 실패:", sessionError);
                  toast({
                    title: "인증 오류",
                    description: "초대 링크 처리 중 오류가 발생했습니다.",
                    variant: "destructive",
                  });
                  return;
                }

                if (data.user) {
                  console.log("세션 설정 성공:", data.user.email);
                  setUser(data.user);
                } else {
                  toast({
                    title: "로그인이 필요합니다",
                    description: "초대 링크를 통해 로그인해주세요.",
                    variant: "destructive",
                  });
                  router.push(`/${locale}/login`);
                  return;
                }
              } else {
                toast({
                  title: "로그인이 필요합니다",
                  description: "초대 링크를 통해 로그인해주세요.",
                  variant: "destructive",
                });
                router.push(`/${locale}/login`);
                return;
              }
            } else {
              toast({
                title: "로그인이 필요합니다",
                description: "초대 링크를 통해 로그인해주세요.",
                variant: "destructive",
              });
              router.push(`/${locale}/login`);
              return;
            }
          } else {
            toast({
              title: "로그인이 필요합니다",
              description: "초대 링크를 통해 로그인해주세요.",
              variant: "destructive",
            });
            router.push(`/${locale}/login`);
            return;
          }
        } else if (!user) {
          toast({
            title: "로그인이 필요합니다",
            description: "초대 링크를 통해 로그인해주세요.",
            variant: "destructive",
          });
          router.push(`/${locale}/login`);
          return;
        } else {
          console.log("사용자 정보 설정:", {
            email: user.email,
            id: user.id,
          });
          setUser(user);
        }

        // 초대 정보 조회
        console.log("초대 정보 조회 시작, token:", token?.substring(0, 20) + "...");
        try {
          const response = await fetch(`/api/invitations/info?token=${token}`);
          console.log("초대 정보 API 응답 상태:", response.status);
          const result = await response.json();
          console.log("초대 정보 API 응답:", result);

          if (result.success) {
            console.log("초대 정보 설정:", result.data);
            setInvitationInfo(result.data);
          } else {
            console.error("초대 정보 조회 실패:", result.error);
            toast({
              title: "초대 정보를 찾을 수 없습니다",
              description: result.error,
              variant: "destructive",
            });
            router.push(`/${locale}/invites/error`);
          }
        } catch (error) {
          console.error("초대 정보 조회 실패:", error);
          toast({
            title: "오류가 발생했습니다",
            description: "초대 정보를 불러오는데 실패했습니다.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("사용자 확인 중 예외 발생:", error);
        toast({
          title: "오류가 발생했습니다",
          description: "사용자 정보를 확인하는 중 오류가 발생했습니다.",
          variant: "destructive",
        });
      }
    };

    checkUser();
  }, [token, locale, router, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log("=== [token] 페이지: handleSubmit 호출 ===");
    console.log("handleSubmit - 상태 확인:", {
      hasToken: !!token,
      tokenLength: token?.length,
      hasUser: !!user,
      userEmail: user?.email,
      passwordLength: password?.length,
    });

    if (password !== confirmPassword) {
      console.log("handleSubmit - 패스워드 불일치");
      toast({
        title: "패스워드가 일치하지 않습니다",
        description: "패스워드를 다시 확인해주세요.",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      console.log("handleSubmit - 패스워드 너무 짧음");
      toast({
        title: "패스워드가 너무 짧습니다",
        description: "최소 6자 이상 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    console.log("handleSubmit - 로딩 시작");

    try {
      const supabase = createClient();

      // 패스워드 업데이트
      console.log("handleSubmit - 패스워드 업데이트 시작");
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        console.error("handleSubmit - 패스워드 업데이트 실패:", updateError);
        throw updateError;
      }

      console.log("handleSubmit - 패스워드 업데이트 성공");

      // 초대 수락 처리
      console.log("handleSubmit - 초대 수락 처리 시작:", {
        hasToken: !!token,
        tokenLength: token?.length,
        userEmail: user?.email,
      });

      if (!token) {
        console.error("handleSubmit - token이 없습니다!");
        throw new Error("초대 토큰이 없습니다");
      }

      const requestBody = {
        tokenHash: token,
        name: user.user_metadata?.name || user.email,
        password: password,
      };

      console.log("=== [token] 페이지: 초대 수락 API 요청 시작 ===");
      console.log("초대 수락 API 호출:", {
        token: token.substring(0, 20) + "...",
        name: requestBody.name,
        hasPassword: !!password,
        requestBody,
      });

      const response = await fetch("/api/invitations/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      console.log("초대 수락 API 응답 상태:", response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("초대 수락 API 오류 응답:", errorText);
        throw new Error(`API 오류: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      console.log("=== [token] 페이지: 초대 수락 API 응답 ===");
      console.log("초대 수락 API 응답:", {
        success: result.success,
        error: result.error,
        data: result.data,
      });

      if (result.success) {
        toast({
          title: "패스워드 설정 완료",
          description: "초대가 성공적으로 수락되었습니다.",
        });

        // 대시보드로 이동
        router.push(`/${locale}/dashboard`);
      } else {
        throw new Error(result.error);
      }
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

  console.log("렌더링 상태 확인:", {
    hasUser: !!user,
    hasInvitationInfo: !!invitationInfo,
    userEmail: user?.email,
    invitationStore: invitationInfo?.stores?.name,
  });

  if (!user || !invitationInfo) {
    console.log("로딩 중 상태:", { hasUser: !!user, hasInvitationInfo: !!invitationInfo });
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>로딩 중...</CardTitle>
            <CardDescription>
              {!user && "사용자 정보를 확인하는 중..."}
              {user && !invitationInfo && "초대 정보를 불러오는 중..."}
            </CardDescription>
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
            {invitationInfo.stores?.name || "알 수 없는 매장"} 매장 초대를
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
                placeholder="최소 6자 이상"
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
