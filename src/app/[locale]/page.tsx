"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { t, type Locale } from "@/lib/i18n";

export default function HomePage() {
  const { locale } = useParams();
  const currentLocale = (locale as Locale) || "ko";

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="flex justify-between items-center p-6">
        <h1 className="text-2xl font-bold text-gray-900">Workeasy</h1>
        <LanguageSwitcher />
      </header>

      {/* Main Content */}
      <main className="flex flex-col items-center justify-center px-6 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-5xl font-bold text-gray-900 mb-6">
            {t("home.title", currentLocale)}
          </h2>
          <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto">
            {t("home.description", currentLocale)}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href={`/${locale}/login`}>
              <Button size="lg" className="w-full sm:w-auto">
                {t("home.login", currentLocale)}
              </Button>
            </Link>
            <Link href={`/${locale}/signup`}>
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                {t("home.signup", currentLocale)}
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
