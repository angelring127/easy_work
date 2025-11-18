-- =============================================
-- stores 테이블의 max_monthly_hours 컬럼명을 max_hours_per_month로 변경
-- =============================================

-- 컬럼명 변경 (컬럼이 존재하는 경우에만)
DO $$
BEGIN
  -- max_monthly_hours 컬럼이 존재하고 max_hours_per_month가 없는 경우에만 변경
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'stores' 
    AND column_name = 'max_monthly_hours'
  ) AND NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'stores' 
    AND column_name = 'max_hours_per_month'
  ) THEN
    ALTER TABLE stores 
      RENAME COLUMN max_monthly_hours TO max_hours_per_month;
  END IF;
END $$;

-- 컬럼이 없으면 생성 (max_monthly_hours도 없고 max_hours_per_month도 없는 경우)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'stores' 
    AND column_name = 'max_hours_per_month'
  ) THEN
    ALTER TABLE stores 
      ADD COLUMN max_hours_per_month NUMERIC(5,2) DEFAULT 160.00 
      CHECK (max_hours_per_month > 0 AND max_hours_per_month <= 999.99);
  END IF;
END $$;

-- 코멘트 업데이트
COMMENT ON COLUMN stores.max_hours_per_month IS 'Maximum monthly working hours for the store (default: 160 hours)';

