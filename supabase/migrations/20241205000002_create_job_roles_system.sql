-- =============================================
-- 매장별 직무 역할 시스템 데이터베이스 스키마
-- =============================================

-- 매장 직무 역할 카탈로그
CREATE TABLE IF NOT EXISTS store_job_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,               -- 선택: 내부 식별자/슬러그
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, name),
  UNIQUE NULLS NOT DISTINCT (store_id, code)
);

-- 유저에게 매장 단위로 직무 역할 부여(복수)
CREATE TABLE IF NOT EXISTS user_store_job_roles (
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  job_role_id UUID NOT NULL REFERENCES store_job_roles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (store_id, user_id, job_role_id)
);

-- 근무 항목이 요구하는 역할(복수)
CREATE TABLE IF NOT EXISTS work_item_required_roles (
  work_item_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  job_role_id UUID NOT NULL REFERENCES store_job_roles(id) ON DELETE CASCADE,
  min_count INT NOT NULL DEFAULT 1 CHECK (min_count >= 0),
  PRIMARY KEY (work_item_id, job_role_id)
);

-- =============================================
-- 인덱스 생성
-- =============================================

-- store_job_roles 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_store_job_roles_store_id ON store_job_roles(store_id);
CREATE INDEX IF NOT EXISTS idx_store_job_roles_active ON store_job_roles(active);
CREATE INDEX IF NOT EXISTS idx_store_job_roles_code ON store_job_roles(store_id, code) WHERE code IS NOT NULL;

-- user_store_job_roles 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_user_store_job_roles_store_user ON user_store_job_roles(store_id, user_id);
CREATE INDEX IF NOT EXISTS idx_user_store_job_roles_store_role ON user_store_job_roles(store_id, job_role_id);

-- work_item_required_roles 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_work_item_required_roles_work_item ON work_item_required_roles(work_item_id);

-- =============================================
-- 트리거 함수: updated_at 자동 갱신
-- =============================================

-- updated_at 자동 갱신 트리거(카탈로그)
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN 
  NEW.updated_at = now(); 
  RETURN NEW; 
END; 
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_store_job_roles_updated_at ON store_job_roles;
CREATE TRIGGER trg_store_job_roles_updated_at
  BEFORE UPDATE ON store_job_roles 
  FOR EACH ROW 
  EXECUTE FUNCTION set_updated_at();

-- =============================================
-- Row Level Security (RLS) 정책
-- =============================================

-- store_job_roles 테이블 RLS 활성화
ALTER TABLE store_job_roles ENABLE ROW LEVEL SECURITY;

-- 조회: 해당 매장 권한 보유자(파트 포함)
CREATE POLICY "sel_store_job_roles" ON store_job_roles
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM user_store_roles r
    WHERE r.store_id = store_job_roles.store_id AND r.user_id = auth.uid()
  )
);

-- 쓰기: 관리자만(MASTER/SUB)
CREATE POLICY "wr_store_job_roles" ON store_job_roles
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM user_store_roles r
    WHERE r.store_id = store_job_roles.store_id AND r.user_id = auth.uid()
      AND r.role IN ('MASTER','SUB_MANAGER')
  )
) WITH CHECK (true);

-- user_store_job_roles 테이블 RLS 활성화
ALTER TABLE user_store_job_roles ENABLE ROW LEVEL SECURITY;

-- 조회: 해당 매장 권한 보유자(파트 포함)
CREATE POLICY "sel_user_store_job_roles" ON user_store_job_roles
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM user_store_roles r
    WHERE r.store_id = user_store_job_roles.store_id AND r.user_id = auth.uid()
  )
);

-- 쓰기: 관리자만(MASTER/SUB)
CREATE POLICY "wr_user_store_job_roles" ON user_store_job_roles
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM user_store_roles r
    WHERE r.store_id = user_store_job_roles.store_id AND r.user_id = auth.uid()
      AND r.role IN ('MASTER','SUB_MANAGER')
  )
) WITH CHECK (true);

-- work_item_required_roles 테이블 RLS 활성화
ALTER TABLE work_item_required_roles ENABLE ROW LEVEL SECURITY;

-- 조회: 해당 매장 권한 보유자(파트 포함)
CREATE POLICY "sel_work_item_required_roles" ON work_item_required_roles
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM work_items w
    JOIN user_store_roles r ON r.store_id = w.store_id AND r.user_id = auth.uid()
    WHERE w.id = work_item_required_roles.work_item_id
  )
);

-- 쓰기: 관리자만(MASTER/SUB)
CREATE POLICY "wr_work_item_required_roles" ON work_item_required_roles
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM user_store_roles r
    JOIN work_items w ON w.id = work_item_required_roles.work_item_id
    WHERE r.store_id = w.store_id AND r.user_id = auth.uid()
      AND r.role IN ('MASTER','SUB_MANAGER')
  )
) WITH CHECK (true);

-- =============================================
-- 유틸리티 함수
-- =============================================

-- 유저의 매장 직무 역할 조회 함수
CREATE OR REPLACE FUNCTION get_user_store_job_roles(
  p_user_id UUID,
  p_store_id UUID
)
RETURNS TABLE (
  job_role_id UUID,
  job_role_name TEXT,
  job_role_code TEXT,
  job_role_description TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sjr.id,
    sjr.name,
    sjr.code,
    sjr.description
  FROM user_store_job_roles usjr
  JOIN store_job_roles sjr ON sjr.id = usjr.job_role_id
  WHERE usjr.user_id = p_user_id 
    AND usjr.store_id = p_store_id
    AND sjr.active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 근무 항목의 역할 요구 조회 함수
CREATE OR REPLACE FUNCTION get_work_item_required_roles(
  p_work_item_id UUID
)
RETURNS TABLE (
  job_role_id UUID,
  job_role_name TEXT,
  job_role_code TEXT,
  min_count INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wirr.job_role_id,
    sjr.name,
    sjr.code,
    wirr.min_count
  FROM work_item_required_roles wirr
  JOIN store_job_roles sjr ON sjr.id = wirr.job_role_id
  WHERE wirr.work_item_id = p_work_item_id
    AND sjr.active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
