/**
 * 통화 관련 유틸리티 함수들
 */

export type CurrencyUnit = "KRW" | "USD" | "JPY" | "EUR" | "CAD" | "AUD";

export interface CurrencyInfo {
  code: CurrencyUnit;
  symbol: string;
  name: string;
  locale: string;
  decimalPlaces: number;
}

export const CURRENCY_INFO: Record<CurrencyUnit, CurrencyInfo> = {
  KRW: {
    code: "KRW",
    symbol: "원",
    name: "한국 원",
    locale: "ko-KR",
    decimalPlaces: 0, // 원은 소수점 없음
  },
  USD: {
    code: "USD",
    symbol: "$",
    name: "미국 달러",
    locale: "en-US",
    decimalPlaces: 2,
  },
  JPY: {
    code: "JPY",
    symbol: "¥",
    name: "일본 엔",
    locale: "ja-JP",
    decimalPlaces: 0, // 엔은 소수점 없음
  },
  EUR: {
    code: "EUR",
    symbol: "€",
    name: "유로",
    locale: "de-DE",
    decimalPlaces: 2,
  },
  CAD: {
    code: "CAD",
    symbol: "C$",
    name: "캐나다 달러",
    locale: "en-CA",
    decimalPlaces: 2,
  },
  AUD: {
    code: "AUD",
    symbol: "A$",
    name: "호주 달러",
    locale: "en-AU",
    decimalPlaces: 2,
  },
};

/**
 * 통화 정보를 가져옵니다
 */
export function getCurrencyInfo(currency: CurrencyUnit): CurrencyInfo {
  return CURRENCY_INFO[currency];
}

/**
 * 금액을 통화 형식으로 포맷팅합니다
 */
export function formatCurrency(
  amount: number,
  currency: CurrencyUnit,
  options: {
    showSymbol?: boolean;
    showCode?: boolean;
    locale?: string;
  } = {}
): string {
  const { showSymbol = true, showCode = false, locale } = options;
  const currencyInfo = getCurrencyInfo(currency);
  const targetLocale = locale || currencyInfo.locale;

  try {
    // Intl.NumberFormat을 사용한 포맷팅
    const formatter = new Intl.NumberFormat(targetLocale, {
      style: "currency",
      currency: currency,
      minimumFractionDigits: currencyInfo.decimalPlaces,
      maximumFractionDigits: currencyInfo.decimalPlaces,
    });

    let formatted = formatter.format(amount);

    // 심볼 표시 옵션에 따른 조정
    if (!showSymbol) {
      // 통화 심볼 제거
      formatted = formatted.replace(/[^\d.,\s-]/g, "").trim();
    }

    // 코드 표시 옵션
    if (showCode) {
      formatted += ` ${currency}`;
    }

    return formatted;
  } catch (error) {
    // Intl.NumberFormat이 지원되지 않는 경우 폴백
    const symbol = showSymbol ? currencyInfo.symbol : "";
    const formattedAmount = amount.toLocaleString(targetLocale, {
      minimumFractionDigits: currencyInfo.decimalPlaces,
      maximumFractionDigits: currencyInfo.decimalPlaces,
    });

    return `${formattedAmount}${symbol}`;
  }
}

/**
 * 통화 심볼만 반환합니다
 */
export function getCurrencySymbol(currency: CurrencyUnit): string {
  return getCurrencyInfo(currency).symbol;
}

/**
 * 통화 이름을 반환합니다
 */
export function getCurrencyName(currency: CurrencyUnit): string {
  return getCurrencyInfo(currency).name;
}

/**
 * 통화 목록을 반환합니다 (Select 옵션용)
 */
export function getCurrencyOptions() {
  return Object.values(CURRENCY_INFO).map((currency) => ({
    value: currency.code,
    label: `${currency.name} (${currency.symbol})`,
    symbol: currency.symbol,
  }));
}

/**
 * 금액을 센트 단위에서 실제 통화 단위로 변환합니다
 * (예: 1000 cents -> 10.00 USD)
 */
export function convertCentsToCurrency(
  cents: number,
  currency: CurrencyUnit
): number {
  const currencyInfo = getCurrencyInfo(currency);

  // KRW, JPY는 소수점이 없으므로 센트 단위를 그대로 사용
  if (currencyInfo.decimalPlaces === 0) {
    return cents;
  }

  // USD, EUR, CAD, AUD는 100으로 나누어 달러 단위로 변환
  return cents / 100;
}

/**
 * 실제 통화 단위를 센트 단위로 변환합니다
 * (예: 10.00 USD -> 1000 cents)
 */
export function convertCurrencyToCents(
  amount: number,
  currency: CurrencyUnit
): number {
  const currencyInfo = getCurrencyInfo(currency);

  // KRW, JPY는 소수점이 없으므로 그대로 사용
  if (currencyInfo.decimalPlaces === 0) {
    return Math.round(amount);
  }

  // USD, EUR, CAD, AUD는 100을 곱하여 센트 단위로 변환
  return Math.round(amount * 100);
}
