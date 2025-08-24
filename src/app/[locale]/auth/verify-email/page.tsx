"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";

export default function VerifyEmailPage() {
  const { locale } = useParams();
  const currentLocale = (locale as Locale) || "ko";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
            <Mail className="h-6 w-6 text-blue-600" />
          </div>
          <CardTitle className="mt-2">
            {t("auth.verify.title", currentLocale)}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-gray-600">
            {t("auth.verify.description", currentLocale)}
            <br />
            {t("auth.verify.instruction", currentLocale)}
          </p>
          <p className="text-xs text-gray-500">
            {t("auth.verify.spam", currentLocale)}
          </p>
          <div className="pt-4">
            <Link href={`/${locale}/login`}>
              <Button variant="outline" className="w-full">
                {t("auth.verify.backToLogin", currentLocale)}
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
