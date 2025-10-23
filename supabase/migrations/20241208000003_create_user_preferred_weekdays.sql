-- =============================================
-- User Preferred Weekdays: 사용자 희망 근무 요일 시스템
-- =============================================

-- 사용자 희망 근무 요일 테이블
CREATE TABLE IF NOT EXISTS user_preferred_weekdays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6), -- 0=일요일, 1=월요일, ..., 6=토요일
  is_preferred BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- 유니크 제약: 같은 매장, 사용자, 요일은 하나만
  UNIQUE(store_id, user_id, weekday)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_user_preferred_weekdays_store_user ON user_preferred_weekdays(store_id, user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferred_weekdays_store_weekday ON user_preferred_weekdays(store_id, weekday);

-- RLS 정책 설정
ALTER TABLE user_preferred_weekdays ENABLE ROW LEVEL SECURITY;

-- 매장 관리자와 사용자 본인만 접근 가능
CREATE POLICY "Users can view their own preferred weekdays" ON user_preferred_weekdays
  FOR SELECT USING (
    auth.uid() = user_id OR 
    EXISTS (
      SELECT 1 FROM user_store_roles usr 
      WHERE usr.user_id = auth.uid() 
      AND usr.store_id = user_preferred_weekdays.store_id 
      AND usr.role IN ('MASTER', 'SUB_MANAGER')
      AND usr.status = 'ACTIVE'
    )
  );

CREATE POLICY "Managers can manage preferred weekdays" ON user_preferred_weekdays
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_store_roles usr 
      WHERE usr.user_id = auth.uid() 
      AND usr.store_id = user_preferred_weekdays.store_id 
      AND usr.role IN ('MASTER', 'SUB_MANAGER')
      AND usr.status = 'ACTIVE'
    )
  );

-- 코멘트 추가
COMMENT ON TABLE user_preferred_weekdays IS '사용자별 희망 근무 요일 설정';
COMMENT ON COLUMN user_preferred_weekdays.weekday IS '요일 (0=일요일, 1=월요일, ..., 6=토요일)';
COMMENT ON COLUMN user_preferred_weekdays.is_preferred IS '해당 요일에 근무 희망 여부';
