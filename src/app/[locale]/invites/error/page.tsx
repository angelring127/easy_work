"use client";
import { defaultLocale } from "@/lib/i18n-config";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";

export default function InviteErrorPage() {
  const { locale } = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const currentLocale = (locale as Locale) || defaultLocale;

  const [errorInfo, setErrorInfo] = useState<{
    error: string;
    errorCode: string;
    errorDescription: string;
  } | null>(null);

  useEffect(() => {
    // URL 해시에서 오류 정보 추출
    const hash = window.location.hash;
    if (hash && hash.includes("error=")) {
      try {
        const urlParams = new URLSearchParams(hash.substring(1));
        const error = urlParams.get("error");
        const errorCode = urlParams.get("error_code");
        const errorDescription = urlParams.get("error_description");

        if (error && errorCode) {
          setErrorInfo({
            error,
            errorCode,
            errorDescription: errorDescription || "",
          });

          console.log("초대 링크 오류 페이지:", {
            error,
            errorCode,
            errorDescription,
          });
        }
      } catch (parseError) {
        console.error("URL 파라미터 파싱 오류:", parseError);
      }
    }
  }, []);

  const getErrorMessage = () => {
    if (!errorInfo) return t("common.unknownError", currentLocale);

    switch (errorInfo.errorCode) {
      case "otp_expired":
        return t("invite.error.message.otpExpired", currentLocale);
      case "access_denied":
        return t("invite.error.message.accessDenied", currentLocale);
      default:
        return t("invite.error.message.invalidInvite", currentLocale);
    }
  };

  const getErrorDescription = () => {
    if (!errorInfo) return t("invite.error.description.default", currentLocale);

    switch (errorInfo.errorCode) {
      case "otp_expired":
        return t("invite.error.description.otpExpired", currentLocale);
      case "access_denied":
        return t("invite.error.description.accessDenied", currentLocale);
      default:
        return t("invite.error.description.invalidInvite", currentLocale);
    }
  };

  const handleRequestNewInvite = () => {
    toast({
      title: t("invite.error.requestNew", currentLocale),
      description: t("invite.error.requestNewDescription", currentLocale),
    });
    // 대시보드로 이동 (로그인된 경우)
    router.push(`/${currentLocale}/dashboard`);
  };

  const handleGoHome = () => {
    router.push(`/${currentLocale}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <Card className="border-red-200 bg-white/80 backdrop-blur-sm">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <CardTitle className="text-xl text-red-800">
              {t("invite.error.title", currentLocale)}
            </CardTitle>
            <CardDescription className="text-red-600">
              {getErrorMessage()}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="text-center text-sm text-gray-600">
              {getErrorDescription()}
            </div>

            {errorInfo && (
              <div className="bg-gray-50 p-3 rounded-lg text-xs text-gray-500">
                <div>
                  <strong>{t("invite.error.code", currentLocale)}:</strong> {errorInfo.errorCode}
                </div>
                <div>
                  <strong>{t("invite.error.type", currentLocale)}:</strong> {errorInfo.error}
                </div>
                {errorInfo.errorDescription && (
                  <div>
                    <strong>{t("invite.error.detail", currentLocale)}:</strong> {errorInfo.errorDescription}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3">
              {errorInfo?.errorCode === "otp_expired" && (
                <Button
                  onClick={handleRequestNewInvite}
                  className="w-full bg-red-600 hover:bg-red-700"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  {t("invite.error.requestNew", currentLocale)}
                </Button>
              )}

              <Button
                variant="outline"
                onClick={handleGoHome}
                className="w-full"
              >
                <Home className="w-4 h-4 mr-2" />
                {t("invite.error.goHome", currentLocale)}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
