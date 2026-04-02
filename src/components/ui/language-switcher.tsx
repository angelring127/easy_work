"use client";

import { useRouter, usePathname } from "next/navigation";
import { useTransition } from "react";
import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { locales, localeNames, setLocaleCookie } from "@/lib/i18n-config";
import { cn } from "@/lib/utils";

interface LanguageSwitcherProps {
  triggerClassName?: string;
  contentClassName?: string;
  itemClassName?: string;
}

export function LanguageSwitcher({
  triggerClassName,
  contentClassName,
  itemClassName,
}: LanguageSwitcherProps = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  // 현재 언어를 pathname에서 추출
  const currentLocale = pathname.split("/")[1] || "en";

  const handleLocaleChange = (newLocale: string) => {
    if (newLocale === currentLocale) return;

    startTransition(() => {
      // 쿠키 설정
      setLocaleCookie(newLocale as any);

      // URL 변경
      const newPath = pathname.replace(`/${currentLocale}`, `/${newLocale}`);
      router.push(newPath);
      router.refresh();
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("gap-2", triggerClassName)}
          disabled={isPending}
        >
          <Globe className="h-4 w-4" />
          <span className="sr-only sm:not-sr-only">
            {localeNames[currentLocale as keyof typeof localeNames] ||
              currentLocale}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={contentClassName}>
        {locales.map((locale) => (
          <DropdownMenuItem
            key={locale}
            onClick={() => handleLocaleChange(locale)}
            className={cn(
              currentLocale === locale ? "bg-accent" : "",
              itemClassName
            )}
            disabled={isPending}
          >
            {localeNames[locale]}
            {locale === currentLocale && " ✓"}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
