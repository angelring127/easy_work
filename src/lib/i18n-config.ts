// 미들웨어용 i18n 설정 (react-i18next 없이)

// 지원하는 언어
export const locales = ["en", "ko", "ja"] as const;
export type Locale = (typeof locales)[number];

// 기본 언어
export const defaultLocale: Locale = "ko";

// 언어명 매핑
export const localeNames: Record<Locale, string> = {
  en: "English",
  ko: "한국어",
  ja: "日本語",
};

// 언어 검증
export function isValidLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale);
}

// 언어 쿠키 설정
export function setLocaleCookie(locale: Locale) {
  if (typeof document !== "undefined") {
    document.cookie = `locale=${locale}; path=/; max-age=31536000; SameSite=lax`;
  }
}

// 쿠키에서 언어 가져오기
export function getLocaleFromCookie(): Locale | null {
  if (typeof document === "undefined") return null;

  const cookies = document.cookie.split(";");
  const localeCookie = cookies.find((cookie) =>
    cookie.trim().startsWith("locale=")
  );

  if (localeCookie) {
    const locale = localeCookie.split("=")[1];
    if (isValidLocale(locale)) {
      return locale as Locale;
    }
  }

  return null;
}

// 브라우저 언어 감지
export function detectLocale(): Locale {
  if (typeof window !== "undefined") {
    const browserLocale = navigator.language.split("-")[0];
    if (isValidLocale(browserLocale)) {
      return browserLocale as Locale;
    }
  }
  return defaultLocale;
}

// 레거시 호환성을 위한 exports
export const SUPPORTED_LOCALES = locales;
export type SupportedLocale = Locale;
export const DEFAULT_LOCALE = defaultLocale;
export const LOCALE_NAMES = localeNames;
