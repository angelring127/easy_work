-- =============================================
-- user_preferred_weekdays 테이블을 user_difficult_weekdays로 이름 변경
-- =============================================

-- 1. 테이블 이름 변경
ALTER TABLE IF EXISTS user_preferred_weekdays 
  RENAME TO user_difficult_weekdays;

-- 2. 인덱스 이름 변경
ALTER INDEX IF EXISTS idx_user_preferred_weekdays_store_user 
  RENAME TO idx_user_difficult_weekdays_store_user;

ALTER INDEX IF EXISTS idx_user_preferred_weekdays_store_weekday 
  RENAME TO idx_user_difficult_weekdays_store_weekday;

ALTER INDEX IF EXISTS user_preferred_weekdays_unique 
  RENAME TO user_difficult_weekdays_unique;

-- 3. RLS 정책 이름 변경
ALTER POLICY IF EXISTS "Users can view their own preferred weekdays" ON user_difficult_weekdays
  RENAME TO "Users can view their own difficult weekdays";

ALTER POLICY IF EXISTS "Managers can manage preferred weekdays" ON user_difficult_weekdays
  RENAME TO "Managers can manage difficult weekdays";

-- 4. 코멘트 업데이트
COMMENT ON TABLE user_difficult_weekdays IS '사용자별 출근이 어려운 요일 설정';
COMMENT ON COLUMN user_difficult_weekdays.is_preferred IS '해당 요일에 출근이 어려운지 여부';

