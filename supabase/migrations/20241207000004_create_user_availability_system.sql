-- =============================================
-- User Availability System: 출근 불가 캘린더 시스템
-- =============================================

-- 사용자 출근 불가 날짜 테이블
CREATE TABLE IF NOT EXISTS user_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  reason TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- 유니크 제약: 같은 매장, 사용자, 날짜는 하나만
  UNIQUE(store_id, user_id, date)
);

-- 스케줄 배정 테이블 (기존 work_items와 연결)
CREATE TABLE IF NOT EXISTS schedule_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  work_item_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'ASSIGNED' CHECK (status IN ('ASSIGNED', 'CONFIRMED', 'CANCELLED')),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- 유니크 제약: 같은 사용자, 날짜, 시간대는 하나만
  UNIQUE(store_id, user_id, date, start_time, end_time)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_user_availability_store_user_date ON user_availability(store_id, user_id, date);
CREATE INDEX IF NOT EXISTS idx_user_availability_store_date ON user_availability(store_id, date);
CREATE INDEX IF NOT EXISTS idx_schedule_assignments_store_user_date ON schedule_assignments(store_id, user_id, date);
CREATE INDEX IF NOT EXISTS idx_schedule_assignments_store_date ON schedule_assignments(store_id, date);
CREATE INDEX IF NOT EXISTS idx_schedule_assignments_work_item ON schedule_assignments(work_item_id);

-- RLS (Row Level Security) 정책 설정
ALTER TABLE user_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_assignments ENABLE ROW LEVEL SECURITY;

-- user_availability RLS 정책
-- 1. 사용자는 본인의 출근 불가 데이터를 조회/수정/삭제 가능
CREATE POLICY "Users can view own availability" ON user_availability
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own availability" ON user_availability
  FOR INSERT WITH CHECK (auth.uid() = user_id AND auth.uid() = created_by);

CREATE POLICY "Users can update own availability" ON user_availability
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own availability" ON user_availability
  FOR DELETE USING (auth.uid() = user_id);

-- 2. 매장 관리자는 해당 매장의 모든 출근 불가 데이터 조회/수정/삭제 가능
CREATE POLICY "Store managers can view all availability" ON user_availability
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_store_roles usr
      WHERE usr.store_id = user_availability.store_id
      AND usr.user_id = auth.uid()
      AND usr.role IN ('MASTER', 'SUB')
      AND usr.status = 'ACTIVE'
    )
  );

CREATE POLICY "Store managers can manage all availability" ON user_availability
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_store_roles usr
      WHERE usr.store_id = user_availability.store_id
      AND usr.user_id = auth.uid()
      AND usr.role IN ('MASTER', 'SUB')
      AND usr.status = 'ACTIVE'
    )
  );

-- schedule_assignments RLS 정책
-- 1. 사용자는 본인의 스케줄 배정을 조회 가능
CREATE POLICY "Users can view own assignments" ON schedule_assignments
  FOR SELECT USING (auth.uid() = user_id);

-- 2. 매장 관리자는 해당 매장의 모든 스케줄 배정 조회/수정/삭제 가능
CREATE POLICY "Store managers can view all assignments" ON schedule_assignments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_store_roles usr
      WHERE usr.store_id = schedule_assignments.store_id
      AND usr.user_id = auth.uid()
      AND usr.role IN ('MASTER', 'SUB')
      AND usr.status = 'ACTIVE'
    )
  );

CREATE POLICY "Store managers can manage all assignments" ON schedule_assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_store_roles usr
      WHERE usr.store_id = schedule_assignments.store_id
      AND usr.user_id = auth.uid()
      AND usr.role IN ('MASTER', 'SUB')
      AND usr.status = 'ACTIVE'
    )
  );

-- updated_at 트리거 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- updated_at 트리거 생성
CREATE TRIGGER update_user_availability_updated_at
  BEFORE UPDATE ON user_availability
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_schedule_assignments_updated_at
  BEFORE UPDATE ON schedule_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 출근 불가 등록 시 배정 확인 함수
CREATE OR REPLACE FUNCTION check_availability_conflicts()
RETURNS TRIGGER AS $$
BEGIN
  -- 해당 날짜에 이미 배정이 있는지 확인
  IF EXISTS (
    SELECT 1 FROM schedule_assignments
    WHERE store_id = NEW.store_id
    AND user_id = NEW.user_id
    AND date = NEW.date
    AND status = 'ASSIGNED'
  ) THEN
    RAISE EXCEPTION 'Cannot mark as unavailable: user already has assignments for this date';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 출근 불가 등록 시 배정 확인 트리거
CREATE TRIGGER check_availability_conflicts_trigger
  BEFORE INSERT ON user_availability
  FOR EACH ROW
  EXECUTE FUNCTION check_availability_conflicts();

-- 스케줄 배정 시 출근 불가 확인 함수
CREATE OR REPLACE FUNCTION check_assignment_availability()
RETURNS TRIGGER AS $$
BEGIN
  -- 해당 날짜에 출근 불가로 등록되어 있는지 확인
  IF EXISTS (
    SELECT 1 FROM user_availability
    WHERE store_id = NEW.store_id
    AND user_id = NEW.user_id
    AND date = NEW.date
  ) THEN
    RAISE EXCEPTION 'Cannot assign: user is marked as unavailable for this date';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 스케줄 배정 시 출근 불가 확인 트리거
CREATE TRIGGER check_assignment_availability_trigger
  BEFORE INSERT ON schedule_assignments
  FOR EACH ROW
  EXECUTE FUNCTION check_assignment_availability();

-- 유틸리티 함수: 사용자의 특정 기간 출근 불가 날짜 조회
CREATE OR REPLACE FUNCTION get_user_unavailable_dates(
  p_store_id UUID,
  p_user_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE(
  date DATE,
  reason TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ua.date,
    ua.reason,
    ua.created_at
  FROM user_availability ua
  WHERE ua.store_id = p_store_id
  AND ua.user_id = p_user_id
  AND ua.date BETWEEN p_start_date AND p_end_date
  ORDER BY ua.date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 유틸리티 함수: 매장의 특정 날짜 출근 불가 사용자 조회
CREATE OR REPLACE FUNCTION get_store_unavailable_users(
  p_store_id UUID,
  p_date DATE
)
RETURNS TABLE(
  user_id UUID,
  user_name TEXT,
  reason TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ua.user_id,
    COALESCE(u.raw_user_meta_data->>'name', u.email) as user_name,
    ua.reason
  FROM user_availability ua
  JOIN auth.users u ON ua.user_id = u.id
  WHERE ua.store_id = p_store_id
  AND ua.date = p_date
  ORDER BY u.raw_user_meta_data->>'name', u.email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 뷰: 사용자별 출근 불가 요약
CREATE OR REPLACE VIEW user_availability_summary AS
SELECT 
  ua.store_id,
  ua.user_id,
  u.raw_user_meta_data->>'name' as user_name,
  u.email,
  COUNT(*) as unavailable_days_count,
  MIN(ua.date) as first_unavailable_date,
  MAX(ua.date) as last_unavailable_date,
  STRING_AGG(ua.date::TEXT, ', ' ORDER BY ua.date) as unavailable_dates
FROM user_availability ua
JOIN auth.users u ON ua.user_id = u.id
GROUP BY ua.store_id, ua.user_id, u.raw_user_meta_data->>'name', u.email;

-- 뷰: 매장별 출근 불가 통계
CREATE OR REPLACE VIEW store_availability_stats AS
SELECT 
  ua.store_id,
  s.name as store_name,
  COUNT(DISTINCT ua.user_id) as users_with_unavailability,
  COUNT(*) as total_unavailable_days,
  COUNT(DISTINCT ua.date) as unique_unavailable_dates,
  AVG(COUNT(*)) OVER (PARTITION BY ua.store_id) as avg_unavailable_days_per_user
FROM user_availability ua
JOIN stores s ON ua.store_id = s.id
GROUP BY ua.store_id, s.name;

-- 뷰에 대한 RLS 정책
ALTER VIEW user_availability_summary SET (security_invoker = true);
ALTER VIEW store_availability_stats SET (security_invoker = true);

-- 코멘트 추가
COMMENT ON TABLE user_availability IS '사용자 출근 불가 날짜 관리';
COMMENT ON TABLE schedule_assignments IS '스케줄 배정 관리';
COMMENT ON FUNCTION get_user_unavailable_dates IS '사용자의 특정 기간 출근 불가 날짜 조회';
COMMENT ON FUNCTION get_store_unavailable_users IS '매장의 특정 날짜 출근 불가 사용자 조회';
COMMENT ON VIEW user_availability_summary IS '사용자별 출근 불가 요약';
COMMENT ON VIEW store_availability_stats IS '매장별 출근 불가 통계';
