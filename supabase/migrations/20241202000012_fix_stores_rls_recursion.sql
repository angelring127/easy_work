-- =============================================
-- Fix stores RLS infinite recursion
-- =============================================

-- 기존 RLS 정책 삭제 (무한 재귀 원인)
DROP POLICY IF EXISTS "Users can view stores they own or are invited to" ON stores;

-- 단순화된 RLS 정책 생성 (무한 재귀 방지)
CREATE POLICY "Users can view stores they own" ON stores
    FOR SELECT USING (owner_id = auth.uid());

-- 초대된 사용자의 매장 조회를 위한 RLS 우회 함수
CREATE OR REPLACE FUNCTION get_user_accessible_stores(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    name VARCHAR(255),
    description TEXT,
    address TEXT,
    phone VARCHAR(50),
    timezone VARCHAR(50),
    status VARCHAR(20),
    owner_id UUID,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    user_role VARCHAR(20),
    granted_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.name,
        s.description,
        s.address,
        s.phone,
        s.timezone,
        s.status,
        s.owner_id,
        s.created_at,
        s.updated_at,
        COALESCE(usr.role, 
            CASE WHEN s.owner_id = p_user_id THEN 'MASTER' ELSE 'PART_TIMER' END
        ) as user_role,
        COALESCE(usr.granted_at, s.created_at) as granted_at
    FROM stores s
    LEFT JOIN user_store_roles usr ON s.id = usr.store_id AND usr.user_id = p_user_id AND usr.status = 'ACTIVE'
    WHERE s.status = 'ACTIVE' 
    AND (s.owner_id = p_user_id OR usr.user_id IS NOT NULL)
    ORDER BY s.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

