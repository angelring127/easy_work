-- =============================================
-- 오전/오후 구분 시간 설정 추가
-- =============================================

-- Stores 테이블에 오전/오후 구분 시간 컬럼 추가
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS shift_boundary_time_min INT DEFAULT 720 
  CHECK (shift_boundary_time_min >= 0 AND shift_boundary_time_min <= 1440);

-- 기존 데이터에 대해 기본값 설정 (12:00 = 720분)
UPDATE stores SET shift_boundary_time_min = 720 WHERE shift_boundary_time_min IS NULL;

-- 주석 추가
COMMENT ON COLUMN stores.shift_boundary_time_min IS '오전/오후 구분 시간 (분 단위, 0-1440, 기본값: 720=12:00)';

