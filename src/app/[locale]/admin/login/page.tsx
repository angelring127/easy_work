"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SignInForm } from "@/features/auth/components/signin-form";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { useAuth } from "@/contexts/auth-context";
import {
  canReadAdminConsole,
  isPlatformAdminRole,
} from "@/lib/auth/platform-admin";
import { useToast } from "@/hooks/use-toast";
import { t, type Locale } from "@/lib/i18n";
import { defaultLocale } from "@/lib/i18n-config";
import type { AuthApiResponse } from "@/lib/validations/auth";

const ADMIN_LOGIN_ERROR_KEY = "admin-login-error";

function AdminSignInContent() {
  const { locale } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentLocale = (locale as Locale) || defaultLocale;
  const { user, loading, signOut } = useAuth();
  const { toast } = useToast();
  const sessionExpired = searchParams.get("sessionExpired") === "true";
  const [accessDeniedMessage, setAccessDeniedMessage] = useState("");

  useEffect(() => {
    const storedMessage = window.sessionStorage.getItem(ADMIN_LOGIN_ERROR_KEY);
    if (!storedMessage) {
      return;
    }

    setAccessDeniedMessage(storedMessage);
    window.sessionStorage.removeItem(ADMIN_LOGIN_ERROR_KEY);
  }, []);

  useEffect(() => {
    if (loading || !user) {
      return;
    }

    if (canReadAdminConsole(user.platform_admin_role)) {
      router.replace(`/${currentLocale}/admin`);
    }
  }, [currentLocale, loading, router, user]);

  const handleSignInSuccess = async (data: AuthApiResponse) => {
    const platformAdminRole = data.data?.user?.platformAdminRole;
    const normalizedPlatformRole = isPlatformAdminRole(platformAdminRole)
      ? platformAdminRole
      : null;

    if (!canReadAdminConsole(normalizedPlatformRole)) {
      const errorMessage = t("admin.login.accessDenied", currentLocale);
      setAccessDeniedMessage(errorMessage);
      window.sessionStorage.setItem(ADMIN_LOGIN_ERROR_KEY, errorMessage);
      toast({
        title: t("auth.login.error", currentLocale),
        description: errorMessage,
        variant: "destructive",
      });
      await signOut();
      return false;
    }

    router.replace(`/${currentLocale}/admin`);
    return true;
  };

  if (loading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4"></div>
          <p className="text-lg font-medium">
            {t("auth.login.loading", currentLocale)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.18),_transparent_28%),linear-gradient(160deg,#020617_0%,#0f172a_50%,#111827_100%)] px-4 py-10 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center justify-center">
        <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="flex flex-col justify-between rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur">
            <div>
              <div className="mb-6 flex items-center justify-between">
                <div className="inline-flex items-center gap-3 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100">
                  <ShieldCheck className="h-4 w-4" />
                  {t("admin.login.badge", currentLocale)}
                </div>
                <LanguageSwitcher
                  triggerClassName="border-white/15 bg-slate-950/60 text-slate-100 hover:bg-slate-900 hover:text-white"
                  contentClassName="border-white/15 bg-slate-950 text-slate-100"
                  itemClassName="focus:bg-cyan-400/15 focus:text-cyan-100"
                />
              </div>
              <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-white">
                {t("admin.login.title", currentLocale)}
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300">
                {t("admin.login.description", currentLocale)}
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  {t("admin.login.panelOneLabel", currentLocale)}
                </p>
                <p className="mt-2 text-sm text-slate-200">
                  {t("admin.login.panelOneValue", currentLocale)}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  {t("admin.login.panelTwoLabel", currentLocale)}
                </p>
                <p className="mt-2 text-sm text-slate-200">
                  {t("admin.login.panelTwoValue", currentLocale)}
                </p>
              </div>
            </div>
          </div>

          <Card className="border-white/10 bg-slate-900/85 text-white shadow-2xl shadow-cyan-950/40">
            <CardHeader>
              <CardTitle>{t("admin.login.loginCard", currentLocale)}</CardTitle>
              <CardDescription className="text-slate-300">
                {t("admin.login.cardDescription", currentLocale)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {accessDeniedMessage && (
                <div className="rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-100">
                  {accessDeniedMessage}
                </div>
              )}

              {sessionExpired && (
                <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
                  {t("auth.login.sessionExpired", currentLocale)}
                </div>
              )}

              <SignInForm
                onSuccess={handleSignInSuccess}
                labelClassName="text-slate-200"
                inputClassName="border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500 focus-visible:ring-cyan-400/70 focus-visible:ring-offset-slate-900"
                messageClassName="text-rose-300"
                submitButtonClassName="bg-cyan-400 text-slate-950 hover:bg-cyan-300"
                passwordToggleClassName="text-slate-400 hover:text-white"
              />

              <div className="space-y-3 text-sm text-slate-300">
                <p>{t("admin.login.helper", currentLocale)}</p>
                <Link
                  href={`/${currentLocale}/login`}
                  className="inline-flex text-cyan-300 hover:text-cyan-200"
                >
                  {t("admin.login.goToUserLogin", currentLocale)}
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function AdminSignInPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AdminSignInContent />
    </Suspense>
  );
}
