"use client";

import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";
import { defaultLocale } from "@/lib/i18n-config";

export default function SignupCompletePage() {
  const { locale } = useParams();
  const router = useRouter();
  const currentLocale = (locale as Locale) || defaultLocale;

  const handleGoToLogin = () => {
    router.push(`/${locale}/login`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          </div>
          <CardTitle className="mt-2">
            {t("auth.signupComplete.title", currentLocale)}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-lg font-medium text-gray-900">
            {t("auth.signupComplete.message", currentLocale)}
          </p>
          <p className="text-sm text-gray-600">
            {t("auth.signupComplete.description", currentLocale)}
          </p>
          <div className="pt-4">
            <Button onClick={handleGoToLogin} className="w-full">
              {t("auth.signupComplete.goToLogin", currentLocale)}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

