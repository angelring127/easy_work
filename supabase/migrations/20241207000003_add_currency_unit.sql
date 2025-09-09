-- =============================================
-- 통화 단위 설정 추가
-- =============================================

-- Stores 테이블에 통화 단위 컬럼 추가
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS currency_unit TEXT NOT NULL DEFAULT 'KRW' 
  CHECK (currency_unit IN ('KRW', 'USD', 'JPY', 'EUR', 'CAD', 'AUD'));

-- 기존 데이터에 대해 기본 통화 단위 설정
UPDATE stores SET currency_unit = 'KRW' WHERE currency_unit IS NULL;

-- 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_stores_currency_unit ON stores(currency_unit);

-- 주석 추가
COMMENT ON COLUMN stores.currency_unit IS '통화 단위: KRW(원), USD(달러), JPY(엔), EUR(유로), CAD(캐나다달러), AUD(호주달러)';

-- 통화 단위별 심볼과 포맷 정보를 위한 뷰 생성
CREATE OR REPLACE VIEW currency_info AS
SELECT 
  currency_unit,
  CASE 
    WHEN currency_unit = 'KRW' THEN '원'
    WHEN currency_unit = 'USD' THEN '$'
    WHEN currency_unit = 'JPY' THEN '¥'
    WHEN currency_unit = 'EUR' THEN '€'
    WHEN currency_unit = 'CAD' THEN 'C$'
    WHEN currency_unit = 'AUD' THEN 'A$'
    ELSE currency_unit
  END as currency_symbol,
  CASE 
    WHEN currency_unit = 'KRW' THEN 'ko-KR'
    WHEN currency_unit = 'USD' THEN 'en-US'
    WHEN currency_unit = 'JPY' THEN 'ja-JP'
    WHEN currency_unit = 'EUR' THEN 'de-DE'
    WHEN currency_unit = 'CAD' THEN 'en-CA'
    WHEN currency_unit = 'AUD' THEN 'en-AU'
    ELSE 'en-US'
  END as locale_format
FROM (SELECT DISTINCT currency_unit FROM stores) t;
