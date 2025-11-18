-- =============================================
-- stores 테이블에 오전/오후 최대 근무 인원 컬럼 추가
-- =============================================

-- 오전 최대 근무 인원 컬럼 추가
ALTER TABLE stores 
  ADD COLUMN IF NOT EXISTS max_morning_staff INT DEFAULT 0 CHECK (max_morning_staff >= 0 AND max_morning_staff <= 999);

-- 오후 최대 근무 인원 컬럼 추가
ALTER TABLE stores 
  ADD COLUMN IF NOT EXISTS max_afternoon_staff INT DEFAULT 0 CHECK (max_afternoon_staff >= 0 AND max_afternoon_staff <= 999);

-- 코멘트 추가
COMMENT ON COLUMN stores.max_morning_staff IS 'Maximum number of staff working in the morning shift (0 = no limit)';
COMMENT ON COLUMN stores.max_afternoon_staff IS 'Maximum number of staff working in the afternoon shift (0 = no limit)';

