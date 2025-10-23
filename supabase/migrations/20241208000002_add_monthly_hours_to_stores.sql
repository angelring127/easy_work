-- Add max_monthly_hours column to stores table
-- stores 테이블에 월간 최대 근무 시간 컬럼 추가

ALTER TABLE stores 
ADD COLUMN max_monthly_hours NUMERIC(5,2) DEFAULT 160.00 CHECK (max_monthly_hours > 0 AND max_monthly_hours <= 999.99);

-- Add comment for documentation
COMMENT ON COLUMN stores.max_monthly_hours IS 'Maximum monthly working hours for the store (default: 160 hours)';
