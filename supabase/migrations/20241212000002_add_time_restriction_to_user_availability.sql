-- =============================================
-- user_availability 테이블에 시간 제한 기능 추가
-- =============================================

-- 1. 시간 제한 관련 컬럼 추가
ALTER TABLE user_availability
  ADD COLUMN IF NOT EXISTS has_time_restriction BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS start_time TIME,
  ADD COLUMN IF NOT EXISTS end_time TIME;

-- 2. 시간 제한이 있는 경우 start_time과 end_time이 필수인지 확인하는 체크 제약조건 추가
ALTER TABLE user_availability
  ADD CONSTRAINT check_time_restriction
  CHECK (
    (has_time_restriction = FALSE AND start_time IS NULL AND end_time IS NULL) OR
    (has_time_restriction = TRUE AND start_time IS NOT NULL AND end_time IS NOT NULL)
  );

-- 3. 코멘트 추가
COMMENT ON COLUMN user_availability.has_time_restriction IS '시간 제한이 있는지 여부 (TRUE인 경우 start_time과 end_time 필수)';
COMMENT ON COLUMN user_availability.start_time IS '출근 불가 시작 시간 (has_time_restriction이 TRUE인 경우 필수)';
COMMENT ON COLUMN user_availability.end_time IS '출근 불가 종료 시간 (has_time_restriction이 TRUE인 경우 필수)';



