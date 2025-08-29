"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { t, type Locale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { useStore } from "@/contexts/store-context";

export default function VerifyEmailPage() {
  const { locale } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { refreshStores } = useStore();
  const currentLocale = (locale as Locale) || "ko";

  const [isLoading, setIsLoading] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isSettingPassword, setIsSettingPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  const token = searchParams.get("token");
  const type = searchParams.get("type");

  console.log("=== VerifyEmailPage 시작 ===");
  console.log("verify-email 페이지 로드:", { token, type });
  console.log("현재 URL:", window.location.href);
  console.log("URL 해시:", window.location.hash);

  useEffect(() => {
    console.log("=== VerifyEmailPage useEffect 시작 ===");
    const checkVerification = async () => {
      try {
        console.log("checkVerification 함수 시작");
        const supabase = createClient();

        // URL 해시 확인 및 처리 (즉시 실행)
        const hash = window.location.hash;
        console.log("VerifyEmailPage: URL 해시 확인", {
          hash: hash.substring(0, 100) + "...",
          fullUrl: window.location.href,
          hasAccessToken: hash.includes("access_token"),
        });

        if (hash && hash.includes("access_token")) {
          const urlParams = new URLSearchParams(hash.substring(1));
          const accessToken = urlParams.get("access_token");
          const type = urlParams.get("type");

          console.log("VerifyEmailPage: URL 해시에서 토큰 확인", {
            accessToken: !!accessToken,
            type,
            tokenLength: accessToken?.length,
          });

          if (accessToken && type === "invite") {
            console.log("VerifyEmailPage: 세션 설정 시도");

            // 토큰으로 세션 설정
            const { data, error: sessionError } =
              await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: urlParams.get("refresh_token") || "",
              });

            if (sessionError) {
              console.error("VerifyEmailPage: 세션 설정 실패", sessionError);
              toast({
                title: "인증 오류",
                description: "초대 링크 처리 중 오류가 발생했습니다.",
                variant: "destructive",
              });
              return;
            }

            if (data.user) {
              console.log("VerifyEmailPage: 세션 설정 성공", data.user.email);
              setUser(data.user);

              // 사용자 메타데이터에서 토큰 가져오기
              const tokenFromMetadata = data.user.user_metadata?.token_hash;
              const tokenToUse = token || tokenFromMetadata;

              console.log("토큰 확인:", {
                urlToken: token,
                metadataToken: tokenFromMetadata,
                tokenToUse,
              });

              // 토큰으로 초대 정보 조회
              if (tokenToUse) {
                try {
                  console.log("토큰으로 초대 정보 조회 시도:", {
                    token: tokenToUse,
                  });

                  const response = await fetch(
                    `/api/invitations/info?token=${tokenToUse}`
                  );
                  const result = await response.json();

                  if (result.success) {
                    console.log("토큰으로 초대 정보 조회 성공:", result.data);
                    console.log("초대가 유효함");
                    setIsVerified(true);
                    setIsLoading(false);
                    return;
                  } else {
                    console.log("토큰으로 초대 정보 조회 실패:", result.error);

                    // 초대가 이미 처리되었거나 만료된 경우
                    if (
                      result.error === "초대를 찾을 수 없습니다" ||
                      result.error === "초대가 만료되었습니다"
                    ) {
                      toast({
                        title: "초대 처리 완료",
                        description:
                          "이미 처리된 초대이거나 만료된 초대입니다.",
                        variant: "destructive",
                      });
                      await refreshStores();
                      router.push(`/${currentLocale}/dashboard`);
                      return;
                    }

                    // 기타 오류의 경우
                    toast({
                      title: "초대 오류",
                      description: result.error,
                      variant: "destructive",
                    });
                    router.push(`/${currentLocale}/invites/error`);
                    return;
                  }
                } catch (error) {
                  console.error("토큰으로 초대 정보 조회 중 오류:", error);
                }
              } else {
                console.log("사용 가능한 토큰이 없음");
              }

              // 초대된 사용자인지 확인
              if (
                data.user.user_metadata?.is_invited_user ||
                data.user.user_metadata?.type === "store_invitation"
              ) {
                console.log("초대된 사용자 확인됨:", data.user.user_metadata);
                setIsVerified(true);
                setIsLoading(false);
                return;
              } else {
                console.log("일반 사용자:", data.user.user_metadata);
                // 일반 사용자면 대시보드로 이동
                await refreshStores();
                router.push(`/${currentLocale}/dashboard`);
                return;
              }
            } else {
              console.log("VerifyEmailPage: 세션 설정 후 사용자 정보 없음");
            }
          } else {
            console.log(
              "VerifyEmailPage: access_token 또는 type이 올바르지 않음",
              {
                hasAccessToken: !!accessToken,
                type,
              }
            );
          }
        } else {
          console.log("VerifyEmailPage: URL 해시에 access_token이 없음");
        }

        // 기존 세션 확인
        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession();

        if (sessionError) {
          console.error("세션 조회 실패:", sessionError);

          // 세션이 없고 토큰이 있으면 패스워드 설정 페이지로 리다이렉트
          if (token) {
            console.log("세션 조회 실패, 패스워드 설정 페이지로 리다이렉트");
            router.push(`/${currentLocale}/invites/setup-password/${token}`);
            return;
          }

          toast({
            title: "인증 오류",
            description: "세션 정보를 찾을 수 없습니다.",
            variant: "destructive",
          });
          return;
        }

        if (!sessionData.session) {
          console.log("세션이 없음, 패스워드 설정 페이지로 리다이렉트");

          if (token) {
            router.push(`/${currentLocale}/invites/setup-password/${token}`);
            return;
          }

          toast({
            title: "인증 오류",
            description: "세션 정보를 찾을 수 없습니다.",
            variant: "destructive",
          });
          return;
        }

        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error) {
          console.error("사용자 정보 조회 실패:", error);

          // AuthSessionMissingError인 경우 특별 처리
          if (error.message.includes("Auth session missing")) {
            console.log(
              "AuthSessionMissingError, 패스워드 설정 페이지로 리다이렉트"
            );

            if (token) {
              router.push(`/${currentLocale}/invites/setup-password/${token}`);
              return;
            }
          }

          // 다른 오류도 패스워드 설정 페이지로 리다이렉트
          if (token) {
            console.log(
              "사용자 정보 조회 실패, 패스워드 설정 페이지로 리다이렉트"
            );
            router.push(`/${currentLocale}/invites/setup-password/${token}`);
            return;
          }

          toast({
            title: "인증 오류",
            description: "사용자 정보를 찾을 수 없습니다.",
            variant: "destructive",
          });
          return;
        }

        if (!user) {
          console.log("사용자가 없음, 패스워드 설정 페이지로 리다이렉트");

          if (token) {
            router.push(`/${currentLocale}/invites/setup-password/${token}`);
            return;
          }

          toast({
            title: "인증 오류",
            description: "사용자 정보를 찾을 수 없습니다.",
            variant: "destructive",
          });
          return;
        }

        setUser(user);

        // 초대된 사용자인지 확인
        if (
          user.user_metadata?.is_invited_user ||
          user.user_metadata?.type === "store_invitation"
        ) {
          console.log("초대된 사용자 확인됨:", user.user_metadata);
          setIsVerified(true);
        } else {
          console.log("일반 사용자:", user.user_metadata);
          // 일반 사용자면 대시보드로 이동
          await refreshStores();
          router.push(`/${currentLocale}/dashboard`);
        }
      } catch (error) {
        console.error("인증 확인 실패:", error);

        // AuthSessionMissingError인 경우 특별 처리
        if (
          error instanceof Error &&
          error.message.includes("Auth session missing")
        ) {
          console.log(
            "AuthSessionMissingError (catch), 패스워드 설정 페이지로 리다이렉트"
          );

          if (token) {
            router.push(`/${currentLocale}/invites/setup-password/${token}`);
            return;
          }
        }

        // 다른 오류도 패스워드 설정 페이지로 리다이렉트
        if (token) {
          console.log("인증 확인 실패, 패스워드 설정 페이지로 리다이렉트");
          router.push(`/${currentLocale}/invites/setup-password/${token}`);
          return;
        }

        toast({
          title: "인증 오류",
          description: "인증 확인 중 오류가 발생했습니다.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    checkVerification();
  }, [currentLocale, router, toast, token]);

  const handleContinueToSetup = () => {
    // 패스워드 설정 폼 표시
    setShowPasswordForm(true);
  };

  const handleSetPassword = async () => {
    if (password !== confirmPassword) {
      toast({
        title: "패스워드 불일치",
        description: "패스워드와 확인 패스워드가 일치하지 않습니다.",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 8) {
      toast({
        title: "패스워드가 너무 짧습니다",
        description: "패스워드는 최소 8자 이상이어야 합니다.",
        variant: "destructive",
      });
      return;
    }

    setIsSettingPassword(true);

    try {
      // 패스워드 업데이트
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        throw new Error(updateError.message);
      }

      // 초대 수락 처리
      if (token) {
        const requestBody = {
          tokenHash: token,
          name:
            user?.user_metadata?.name || user?.email?.split("@")[0] || "사용자",
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
      }

      toast({
        title: "초대 수락 완료",
        description: "패스워드가 설정되고 초대가 수락되었습니다.",
      });

      // 매장 목록 새로고침 후 대시보드로 이동
      await refreshStores();
      router.push(`/${currentLocale}/dashboard`);
    } catch (error) {
      console.error("패스워드 설정 및 초대 수락 실패:", error);
      toast({
        title: "오류 발생",
        description:
          error instanceof Error
            ? error.message
            : "패스워드 설정 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsSettingPassword(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">인증 확인 중...</div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!isVerified) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <Card className="border-red-200">
            <CardHeader className="text-center">
              <CardTitle className="text-red-800">인증 오류</CardTitle>
              <CardDescription>이메일 인증이 필요합니다.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <Card>
          <CardHeader className="text-center">
            <CardTitle>
              {showPasswordForm ? "패스워드 설정" : "이메일 인증 완료"}
            </CardTitle>
            <CardDescription>
              {showPasswordForm
                ? "안전한 패스워드를 설정하고 초대를 수락해주세요."
                : "초대 링크가 성공적으로 확인되었습니다. 패스워드를 설정해주세요."}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {!showPasswordForm ? (
              <>
                <div className="bg-green-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-green-900 mb-2">
                    인증 정보
                  </h3>
                  <div className="text-sm text-green-800 space-y-1">
                    <div>
                      <strong>이메일:</strong> {user?.email}
                    </div>
                    <div className="text-xs text-green-600 mt-2">
                      * 안전한 패스워드를 설정해주세요.
                    </div>
                  </div>
                </div>

                <Button onClick={handleContinueToSetup} className="w-full">
                  패스워드 설정하기
                </Button>
              </>
            ) : (
              <>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-blue-900 mb-2">
                    사용자 정보
                  </h3>
                  <div className="text-sm text-blue-800 space-y-1">
                    <div>
                      <strong>이메일:</strong> {user?.email}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="password">새 패스워드</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="새 패스워드를 입력하세요 (최소 8자)"
                      disabled={isSettingPassword}
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      패스워드는 최소 8자 이상이어야 합니다.
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="confirmPassword">패스워드 확인</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="패스워드를 다시 입력하세요"
                      disabled={isSettingPassword}
                    />
                  </div>
                </div>

                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowPasswordForm(false)}
                    disabled={isSettingPassword}
                    className="flex-1"
                  >
                    뒤로
                  </Button>
                  <Button
                    onClick={handleSetPassword}
                    disabled={
                      isSettingPassword ||
                      !password ||
                      !confirmPassword ||
                      password.length < 8
                    }
                    className="flex-1"
                  >
                    {isSettingPassword
                      ? "처리 중..."
                      : "패스워드 설정 및 초대 수락"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
