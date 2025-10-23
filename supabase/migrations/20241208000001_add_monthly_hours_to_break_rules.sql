-- Add max_monthly_hours column to break_rules table
-- 월간 최대 근무 시간 컬럼을 break_rules 테이블에 추가

ALTER TABLE break_rules 
ADD COLUMN max_monthly_hours NUMERIC(5,2) DEFAULT 160.00 CHECK (max_monthly_hours > 0 AND max_monthly_hours <= 999.99);

-- Add comment for documentation
COMMENT ON COLUMN break_rules.max_monthly_hours IS 'Maximum monthly working hours (default: 160 hours)';
