"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { t, type Locale } from "@/lib/i18n";
import { defaultLocale } from "@/lib/i18n-config";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";

export default function HomePage() {
  const { locale } = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { setProcessingInvite } = useAuth();
  const currentLocale = (locale as Locale) || defaultLocale;

  useEffect(() => {
    // 초대 토큰 및 오류 처리
    const handleInviteToken = async () => {
      const hash = window.location.hash;

      console.log("HomePage: URL 해시 확인", {
        hash: hash.substring(0, 100) + "...",
        fullUrl: window.location.href,
      });

      // 오류 처리
      if (hash && hash.includes("error=")) {
        try {
          const urlParams = new URLSearchParams(hash.substring(1));
          const error = urlParams.get("error");
          const errorCode = urlParams.get("error_code");
          const errorDescription = urlParams.get("error_description");

          console.log("초대 링크 오류 감지:", {
            error,
            errorCode,
            errorDescription,
          });

          // 오류 페이지로 리다이렉트
          router.push(`/${currentLocale}/invites/error`);
          return;
        } catch (parseError) {
          console.error("URL 파라미터 파싱 오류:", parseError);
          router.push(`/${currentLocale}/invites/error`);
          return;
        }
      }

      // 초대 토큰 처리
      if (hash && hash.includes("access_token")) {
        const urlParams = new URLSearchParams(hash.substring(1));
        const accessToken = urlParams.get("access_token");
        const type = urlParams.get("type");

        console.log("HomePage: URL 해시 파싱:", {
          hash,
          accessToken: !!accessToken,
          type,
          urlParams: Object.fromEntries(urlParams.entries()),
        });

        if (accessToken && type === "invite") {
          console.log("HomePage: 초대 토큰 감지:", {
            accessToken: accessToken.substring(0, 20) + "...",
            type,
          });

          // 초대 토큰 처리 시작
          setProcessingInvite(true);

          const supabase = createClient();

          // 토큰으로 세션 설정
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: urlParams.get("refresh_token") || "",
          });

          if (error) {
            console.error("HomePage: 세션 설정 실패:", error);
            toast({
              title: t("home.inviteError.title", currentLocale),
              description: t("home.inviteError.description", currentLocale),
              variant: "destructive",
            });
            setProcessingInvite(false);
            return;
          }

          console.log("HomePage: 세션 설정 성공:", {
            user: data.user?.email,
            userMetadata: data.user?.user_metadata,
          });

          if (data.user?.user_metadata?.type === "store_invitation") {
            const tokenHash = data.user.user_metadata?.token_hash;
            if (tokenHash) {
              console.log(
                "HomePage: 패스워드 설정 페이지로 리다이렉트:",
                tokenHash
              );
              router.push(
                `/${currentLocale}/invites/setup-password/${tokenHash}`
              );
              return;
            } else {
              console.log(
                "HomePage: 토큰 해시가 없음:",
                data.user.user_metadata
              );
            }
          } else {
            console.log(
              "HomePage: 스토어 초대가 아님:",
              data.user?.user_metadata?.type
            );
          }
        }
      }
    };

    // 즉시 실행
    handleInviteToken();

    // 추가로 1초, 2초, 3초 후에도 다시 확인 (해시가 늦게 로드되는 경우)
    const timeoutId1 = setTimeout(() => {
      console.log("HomePage: 1초 후 URL 해시 재확인");
      handleInviteToken();
    }, 1000);

    const timeoutId2 = setTimeout(() => {
      console.log("HomePage: 2초 후 URL 해시 재확인");
      handleInviteToken();
    }, 2000);

    const timeoutId3 = setTimeout(() => {
      console.log("HomePage: 3초 후 URL 해시 재확인");
      handleInviteToken();
    }, 3000);

    return () => {
      clearTimeout(timeoutId1);
      clearTimeout(timeoutId2);
      clearTimeout(timeoutId3);
    };
  }, [currentLocale, router, setProcessingInvite, toast]);

  const metrics = [
    {
      value: t("home.metric.schedule.value", currentLocale),
      label: t("home.metric.schedule.label", currentLocale),
    },
    {
      value: t("home.metric.coverage.value", currentLocale),
      label: t("home.metric.coverage.label", currentLocale),
    },
    {
      value: t("home.metric.team.value", currentLocale),
      label: t("home.metric.team.label", currentLocale),
    },
  ];

  const features = [
    {
      icon: CalendarCheck,
      title: t("home.feature.schedule.title", currentLocale),
      description: t("home.feature.schedule.description", currentLocale),
    },
    {
      icon: UsersRound,
      title: t("home.feature.team.title", currentLocale),
      description: t("home.feature.team.description", currentLocale),
    },
    {
      icon: BarChart3,
      title: t("home.feature.analytics.title", currentLocale),
      description: t("home.feature.analytics.description", currentLocale),
    },
  ];

  const scheduleRows = [
    {
      day: t("home.preview.day.mon", currentLocale),
      time: t("home.preview.shift.open", currentLocale),
      role: t("home.preview.role.barista", currentLocale),
      accent: "bg-blue-600",
    },
    {
      day: t("home.preview.day.tue", currentLocale),
      time: t("home.preview.shift.lunch", currentLocale),
      role: t("home.preview.role.kitchen", currentLocale),
      accent: "bg-green-600",
    },
    {
      day: t("home.preview.day.wed", currentLocale),
      time: t("home.preview.shift.close", currentLocale),
      role: t("home.preview.role.closing", currentLocale),
      accent: "bg-slate-500",
    },
  ];

  const trustPoints = [
    t("home.trust.point.one", currentLocale),
    t("home.trust.point.two", currentLocale),
    t("home.trust.point.three", currentLocale),
  ];

  return (
    <div className="min-h-screen overflow-hidden bg-gray-50 text-gray-900">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <Link
          href={`/${currentLocale}`}
          className="flex items-center gap-3 text-lg font-bold"
        >
          <Image
            src="/easynext.png"
            alt="Workeasy"
            width={40}
            height={40}
            className="h-10 w-10 rounded-lg border border-slate-200 bg-white"
            priority
          />
          <span>Workeasy</span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-gray-600 md:flex">
          <a href="#features" className="transition-colors hover:text-gray-950">
            {t("home.nav.features", currentLocale)}
          </a>
          <a href="#preview" className="transition-colors hover:text-gray-950">
            {t("home.nav.preview", currentLocale)}
          </a>
          <a href="#trust" className="transition-colors hover:text-gray-950">
            {t("home.nav.trust", currentLocale)}
          </a>
        </nav>

        <LanguageSwitcher />
      </header>

      <main>
        <section className="mx-auto grid max-w-7xl gap-10 px-5 pb-12 pt-8 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(380px,0.86fr)] lg:items-center lg:pb-16 lg:pt-14">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-sm font-semibold text-orange-700 shadow-sm">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              {t("home.badge", currentLocale)}
            </div>

            <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-normal text-gray-950 sm:text-5xl lg:text-6xl">
              {t("home.title", currentLocale)}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-gray-600 sm:text-xl">
              {t("home.description", currentLocale)}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-12 px-6">
                <Link href={`/${currentLocale}/signup`}>
                  {t("home.signup", currentLocale)}
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-12 border-gray-300 bg-white px-6"
              >
                <Link href={`/${currentLocale}/login`}>
                  {t("home.login", currentLocale)}
                </Link>
              </Button>
            </div>

            <div className="mt-10 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
              {metrics.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-4 shadow-sm"
                >
                  <div className="text-2xl font-bold text-gray-950">
                    {metric.value}
                  </div>
                  <div className="mt-1 text-sm leading-5 text-gray-600">
                    {metric.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div id="preview" className="relative">
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-lg shadow-gray-200/70 sm:p-5">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-blue-600">
                    {t("home.preview.kicker", currentLocale)}
                  </div>
                  <h2 className="mt-1 text-xl font-bold text-gray-950">
                    {t("home.preview.title", currentLocale)}
                  </h2>
                </div>
                <div className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-bold text-green-700">
                  {t("home.preview.status", currentLocale)}
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1 rounded-lg bg-gray-100 p-2 text-center text-xs font-semibold text-gray-500">
                {["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map(
                  (day) => (
                    <div key={day} className="rounded-md bg-white py-2">
                      {t(`home.preview.week.${day}`, currentLocale)}
                    </div>
                  )
                )}
              </div>

              <div className="mt-4 space-y-3">
                {scheduleRows.map((row) => (
                  <div
                    key={row.day}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm"
                  >
                    <div
                      className={`h-10 w-1.5 rounded-full ${row.accent}`}
                      aria-hidden="true"
                    />
                    <div>
                      <div className="text-sm font-bold text-gray-950">
                        {row.day}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
                        <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                        {row.time}
                      </div>
                    </div>
                    <div className="rounded-md bg-gray-100 px-3 py-2 text-xs font-bold text-gray-700">
                      {row.role}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-lg border border-green-200 bg-green-50 p-4">
                <div className="flex items-center gap-2 text-sm font-bold text-green-700">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  {t("home.preview.coverageTitle", currentLocale)}
                </div>
                <p className="mt-2 text-sm leading-6 text-green-800">
                  {t("home.preview.coverageText", currentLocale)}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section
          id="features"
          className="border-y border-gray-200 bg-white px-5 py-12 sm:px-8"
        >
          <div className="mx-auto max-w-7xl">
            <div className="max-w-2xl">
              <div className="text-sm font-bold uppercase tracking-normal text-blue-600">
                {t("home.features.kicker", currentLocale)}
              </div>
              <h2 className="mt-3 text-3xl font-bold text-gray-950">
                {t("home.features.title", currentLocale)}
              </h2>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {features.map((feature) => {
                const FeatureIcon = feature.icon;

                return (
                  <div
                    key={feature.title}
                    className="rounded-lg border border-gray-200 bg-gray-50 p-5"
                  >
                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-gray-950 text-white">
                      <FeatureIcon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-950">
                      {feature.title}
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-gray-600">
                      {feature.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="trust" className="px-5 py-12 sm:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm sm:p-8 lg:grid-cols-[0.85fr_1fr] lg:items-center">
            <div>
              <div className="text-sm font-bold uppercase tracking-normal text-orange-600">
                {t("home.trust.kicker", currentLocale)}
              </div>
              <h2 className="mt-3 text-3xl font-bold text-gray-950">
                {t("home.trust.title", currentLocale)}
              </h2>
              <p className="mt-4 text-sm leading-6 text-gray-600">
                {t("home.trust.description", currentLocale)}
              </p>
            </div>

            <div className="grid gap-3">
              {trustPoints.map((point) => (
                <div
                  key={point}
                  className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4"
                >
                  <CheckCircle2
                    className="mt-0.5 h-5 w-5 flex-none text-green-600"
                    aria-hidden="true"
                  />
                  <span className="text-sm leading-6 text-gray-700">
                    {point}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
