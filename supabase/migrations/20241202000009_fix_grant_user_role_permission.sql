-- =============================================
-- Fix grant_user_role function permission check
-- =============================================

-- 사용자 역할 부여 함수 수정 (권한 확인 로직 개선)
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
    -- 권한 확인: 매장 소유자 또는 서브 매니저만 역할 부여 가능
    IF NOT EXISTS (
        SELECT 1 FROM user_store_roles 
        WHERE user_id = p_granted_by 
        AND store_id = p_store_id 
        AND role IN ('MASTER', 'SUB_MANAGER')
        AND status = 'ACTIVE'
    ) THEN
        RAISE EXCEPTION 'Permission denied: Only store owner or sub manager can grant roles';
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





