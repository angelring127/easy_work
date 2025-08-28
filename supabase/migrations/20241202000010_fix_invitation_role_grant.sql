-- =============================================
-- Fix invitation role grant function
-- =============================================

-- 초대 수락 시 매장 등록을 위한 전용 함수 (권한 확인 없음)
CREATE OR REPLACE FUNCTION grant_user_role_by_invitation(
    p_user_id UUID,
    p_store_id UUID,
    p_role VARCHAR(20),
    p_invited_by UUID
)
RETURNS UUID AS $$
DECLARE
    role_id UUID;
BEGIN
    -- 초대 수락 시에는 권한 확인 없이 역할 부여
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
    
    -- 감사 로그 기록
    INSERT INTO store_audit_logs (
        store_id, user_id, action, table_name, old_values, new_values
    ) VALUES (
        p_store_id, 
        p_invited_by,
        'GRANT_ROLE_BY_INVITATION', 
        'user_store_roles',
        '{}'::jsonb,
        jsonb_build_object(
            'user_id', p_user_id,
            'role', p_role,
            'invited_by', p_invited_by
        )
    );
    
    RETURN role_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
