-- =============================================
-- 사용자 관리 시스템 데이터베이스 스키마
-- =============================================

-- user_store_roles 테이블 생성 (사용자-매장-역할 관계)
CREATE TABLE IF NOT EXISTS user_store_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('MASTER', 'SUB_MANAGER', 'PART_TIMER')),
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('PENDING', 'ACTIVE', 'INACTIVE')),
  is_default_store BOOLEAN DEFAULT false, -- 기본 소속 매장 여부
  temporary_start_date DATE, -- 임시 근무 시작일
  temporary_end_date DATE, -- 임시 근무 종료일
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  -- 한 사용자는 한 매장에서 하나의 역할만 가질 수 있음
  UNIQUE(user_id, store_id)
);

-- 임시 근무 배치 테이블
CREATE TABLE IF NOT EXISTS temporary_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  -- 한 사용자는 같은 기간에 한 매장에만 임시 배치 가능
  UNIQUE(user_id, store_id, start_date, end_date)
);

-- =============================================
-- 인덱스 생성
-- =============================================

-- user_store_roles 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_user_store_roles_user_id ON user_store_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_store_roles_store_id ON user_store_roles(store_id);
CREATE INDEX IF NOT EXISTS idx_user_store_roles_role ON user_store_roles(role);
CREATE INDEX IF NOT EXISTS idx_user_store_roles_status ON user_store_roles(status);
CREATE INDEX IF NOT EXISTS idx_user_store_roles_default ON user_store_roles(is_default_store);

-- temporary_assignments 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_temporary_assignments_user_id ON temporary_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_temporary_assignments_store_id ON temporary_assignments(store_id);
CREATE INDEX IF NOT EXISTS idx_temporary_assignments_date_range ON temporary_assignments(start_date, end_date);

-- =============================================
-- 트리거 함수: updated_at 자동 업데이트
-- =============================================

-- user_store_roles 테이블에 updated_at 트리거 적용
CREATE TRIGGER update_user_store_roles_updated_at 
    BEFORE UPDATE ON user_store_roles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- temporary_assignments 테이블에 updated_at 트리거 적용
CREATE TRIGGER update_temporary_assignments_updated_at 
    BEFORE UPDATE ON temporary_assignments 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- Row Level Security (RLS) 정책
-- =============================================

-- user_store_roles 테이블 RLS 활성화
ALTER TABLE user_store_roles ENABLE ROW LEVEL SECURITY;

-- 매장 관리자만 user_store_roles 조회 가능
CREATE POLICY "Store managers can view user store roles" ON user_store_roles
    FOR SELECT USING (
        store_id IN (
            SELECT id FROM stores WHERE owner_id = auth.uid()
        ) OR
        store_id IN (
            SELECT store_id FROM user_store_roles 
            WHERE user_id = auth.uid() AND role IN ('MASTER', 'SUB_MANAGER') AND status = 'ACTIVE'
        )
    );

-- 매장 소유자만 user_store_roles 수정 가능
CREATE POLICY "Store owners can manage user store roles" ON user_store_roles
    FOR ALL USING (
        store_id IN (
            SELECT id FROM stores WHERE owner_id = auth.uid()
        )
    );

-- temporary_assignments 테이블 RLS 활성화
ALTER TABLE temporary_assignments ENABLE ROW LEVEL SECURITY;

-- 매장 관리자만 임시 배치 조회 가능
CREATE POLICY "Store managers can view temporary assignments" ON temporary_assignments
    FOR SELECT USING (
        store_id IN (
            SELECT id FROM stores WHERE owner_id = auth.uid()
        ) OR
        store_id IN (
            SELECT store_id FROM user_store_roles 
            WHERE user_id = auth.uid() AND role IN ('MASTER', 'SUB_MANAGER') AND status = 'ACTIVE'
        )
    );

-- 매장 소유자만 임시 배치 관리 가능
CREATE POLICY "Store owners can manage temporary assignments" ON temporary_assignments
    FOR ALL USING (
        store_id IN (
            SELECT id FROM stores WHERE owner_id = auth.uid()
        )
    );

-- =============================================
-- 유틸리티 함수
-- =============================================

-- 사용자 역할 부여 함수
CREATE OR REPLACE FUNCTION grant_user_role(
    p_user_id UUID,
    p_store_id UUID,
    p_role VARCHAR(20),
    p_granted_by UUID DEFAULT auth.uid()
)
RETURNS UUID AS $$
DECLARE
    role_id UUID;
BEGIN
    -- 권한 확인: 매장 소유자만 역할 부여 가능
    IF NOT EXISTS (
        SELECT 1 FROM stores 
        WHERE id = p_store_id AND owner_id = p_granted_by
    ) THEN
        RAISE EXCEPTION 'Permission denied: Only store owner can grant roles';
    END IF;

    -- 기존 역할이 있으면 업데이트, 없으면 새로 생성
    INSERT INTO user_store_roles (
        user_id, store_id, role, status, granted_at
    ) VALUES (
        p_user_id, p_store_id, p_role, 'ACTIVE', NOW()
    )
    ON CONFLICT (user_id, store_id) 
    DO UPDATE SET 
        role = p_role,
        status = 'ACTIVE',
        updated_at = NOW()
    RETURNING id INTO role_id;
    
    RETURN role_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 사용자 역할 회수 함수
CREATE OR REPLACE FUNCTION revoke_user_role(
    p_user_id UUID,
    p_store_id UUID,
    p_revoked_by UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN AS $$
BEGIN
    -- 권한 확인: 매장 소유자만 역할 회수 가능
    IF NOT EXISTS (
        SELECT 1 FROM stores 
        WHERE id = p_store_id AND owner_id = p_revoked_by
    ) THEN
        RAISE EXCEPTION 'Permission denied: Only store owner can revoke roles';
    END IF;

    -- 역할을 INACTIVE로 변경 (완전 삭제 대신)
    UPDATE user_store_roles 
    SET status = 'INACTIVE', updated_at = NOW()
    WHERE user_id = p_user_id AND store_id = p_store_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 임시 근무 배치 함수
CREATE OR REPLACE FUNCTION assign_temporary_work(
    p_user_id UUID,
    p_store_id UUID,
    p_start_date DATE,
    p_end_date DATE,
    p_reason TEXT DEFAULT NULL,
    p_assigned_by UUID DEFAULT auth.uid()
)
RETURNS UUID AS $$
DECLARE
    assignment_id UUID;
BEGIN
    -- 권한 확인: 매장 소유자만 임시 배치 가능
    IF NOT EXISTS (
        SELECT 1 FROM stores 
        WHERE id = p_store_id AND owner_id = p_assigned_by
    ) THEN
        RAISE EXCEPTION 'Permission denied: Only store owner can assign temporary work';
    END IF;

    -- 날짜 유효성 검사
    IF p_start_date >= p_end_date THEN
        RAISE EXCEPTION 'Start date must be before end date';
    END IF;

    -- 기존 배치와 겹치는지 확인
    IF EXISTS (
        SELECT 1 FROM temporary_assignments 
        WHERE user_id = p_user_id 
        AND store_id = p_store_id
        AND (
            (p_start_date BETWEEN start_date AND end_date) OR
            (p_end_date BETWEEN start_date AND end_date) OR
            (start_date BETWEEN p_start_date AND p_end_date)
        )
    ) THEN
        RAISE EXCEPTION 'Temporary assignment conflicts with existing assignment';
    END IF;

    -- 임시 배치 생성
    INSERT INTO temporary_assignments (
        user_id, store_id, assigned_by, start_date, end_date, reason
    ) VALUES (
        p_user_id, p_store_id, p_assigned_by, p_start_date, p_end_date, p_reason
    ) RETURNING id INTO assignment_id;
    
    RETURN assignment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 뷰 생성
-- =============================================

-- 매장 구성원 상세 정보 뷰
CREATE OR REPLACE VIEW store_members AS
SELECT 
    usr.id,
    usr.user_id,
    usr.store_id,
    usr.role,
    usr.status,
    usr.is_default_store,
    usr.granted_at,
    usr.updated_at,
    u.email,
    u.raw_user_meta_data->>'name' as name,
    u.raw_user_meta_data->>'avatar_url' as avatar_url,
    u.created_at as user_created_at,
    u.last_sign_in_at,
    -- 임시 근무 정보
    ta.start_date as temp_start_date,
    ta.end_date as temp_end_date,
    ta.reason as temp_reason
FROM user_store_roles usr
JOIN auth.users u ON usr.user_id = u.id
LEFT JOIN temporary_assignments ta ON usr.user_id = ta.user_id AND usr.store_id = ta.store_id
WHERE usr.status != 'INACTIVE';

-- RLS 정책 적용
ALTER VIEW store_members SET (security_invoker = true);
