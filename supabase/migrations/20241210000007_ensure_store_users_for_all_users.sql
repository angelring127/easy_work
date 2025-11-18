-- =============================================
-- 모든 일반 유저가 store_users에 레코드를 가지도록 보장
-- =============================================

-- 1. 매장 생성 시 마스터의 store_users 레코드도 생성하는 트리거 함수 수정
CREATE OR REPLACE FUNCTION add_master_to_user_store_roles()
RETURNS TRIGGER AS $$
DECLARE
    role_id UUID;
    store_user_id UUID;
BEGIN
    -- 새로 생성된 매장의 소유자를 user_store_roles에 추가
    INSERT INTO user_store_roles (
        user_id,
        store_id,
        role,
        status,
        is_default_store,
        granted_at
    ) VALUES (
        NEW.owner_id,
        NEW.id,
        'MASTER',
        'ACTIVE',
        true,
        NEW.created_at
    ) ON CONFLICT (user_id, store_id) DO UPDATE SET
        role = 'MASTER',
        status = 'ACTIVE',
        updated_at = NOW()
    RETURNING id INTO role_id;
    
    -- store_users에도 레코드 생성 (없는 경우에만)
    INSERT INTO store_users (
        store_id,
        user_id,
        role,
        is_guest,
        is_active,
        granted_by,
        granted_at
    ) VALUES (
        NEW.id,
        NEW.owner_id,
        'MASTER',
        false,
        true,
        NEW.owner_id,
        NEW.created_at
    ) ON CONFLICT (store_id, user_id, is_active) 
    WHERE is_active = true AND user_id IS NOT NULL
    DO UPDATE SET
        role = 'MASTER'
    RETURNING id INTO store_user_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. 초대 수락 시 store_users 레코드도 생성하는 함수 수정
CREATE OR REPLACE FUNCTION grant_user_role_by_invitation(
    p_user_id UUID,
    p_store_id UUID,
    p_role VARCHAR(20),
    p_invited_by UUID
)
RETURNS UUID AS $$
DECLARE
    role_id UUID;
    store_user_id UUID;
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
    
    -- store_users에도 레코드 생성 (없는 경우에만)
    INSERT INTO store_users (
        store_id,
        user_id,
        role,
        is_guest,
        is_active,
        granted_by,
        granted_at
    ) VALUES (
        p_store_id,
        p_user_id,
        p_role,
        false,
        true,
        p_invited_by,
        NOW()
    ) ON CONFLICT (store_id, user_id, is_active) 
    WHERE is_active = true AND user_id IS NOT NULL
    DO UPDATE SET
        role = p_role
    RETURNING id INTO store_user_id;
    
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
            'invited_by', p_invited_by,
            'store_user_id', store_user_id
        )
    );
    
    RETURN role_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. user_store_roles에 레코드가 있으면 store_users에도 레코드가 있도록 보장하는 트리거
CREATE OR REPLACE FUNCTION ensure_store_user_exists()
RETURNS TRIGGER AS $$
DECLARE
    store_user_id UUID;
BEGIN
    -- user_store_roles에 레코드가 생성/업데이트될 때 store_users에도 레코드가 있는지 확인
    IF NEW.status = 'ACTIVE' THEN
        INSERT INTO store_users (
            store_id,
            user_id,
            role,
            is_guest,
            is_active,
            granted_by,
            granted_at
        ) VALUES (
            NEW.store_id,
            NEW.user_id,
            NEW.role,
            false,
            true,
            NEW.user_id, -- user_store_roles에는 granted_by가 없으므로 user_id 사용
            NEW.granted_at
        ) ON CONFLICT (store_id, user_id, is_active) 
        WHERE is_active = true AND user_id IS NOT NULL
        DO UPDATE SET
            role = NEW.role;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- user_store_roles 테이블에 트리거 추가
DROP TRIGGER IF EXISTS trigger_ensure_store_user_exists ON user_store_roles;
CREATE TRIGGER trigger_ensure_store_user_exists
    AFTER INSERT OR UPDATE ON user_store_roles
    FOR EACH ROW
    WHEN (NEW.status = 'ACTIVE')
    EXECUTE FUNCTION ensure_store_user_exists();

-- 4. 기존 user_store_roles 레코드에 대해 store_users 레코드 생성
INSERT INTO store_users (
    store_id,
    user_id,
    role,
    is_guest,
    is_active,
    granted_by,
    granted_at
)
SELECT 
    usr.store_id,
    usr.user_id,
    usr.role,
    false,
    true,
    usr.user_id, -- user_store_roles에는 granted_by가 없으므로 user_id 사용
    usr.granted_at
FROM user_store_roles usr
WHERE usr.status = 'ACTIVE'
    AND NOT EXISTS (
        SELECT 1 
        FROM store_users su 
        WHERE su.store_id = usr.store_id 
            AND su.user_id = usr.user_id 
            AND su.is_active = true
            AND su.is_guest = false
    )
ON CONFLICT (store_id, user_id, is_active) 
WHERE is_active = true AND user_id IS NOT NULL
DO NOTHING;

-- 5. 주석 추가
COMMENT ON FUNCTION ensure_store_user_exists() IS 'user_store_roles에 레코드가 생성/업데이트될 때 store_users에도 레코드가 있도록 보장하는 트리거 함수';
COMMENT ON FUNCTION add_master_to_user_store_roles() IS '매장 생성 시 마스터를 user_store_roles와 store_users에 자동 추가하는 트리거 함수';
COMMENT ON FUNCTION grant_user_role_by_invitation(UUID, UUID, VARCHAR, UUID) IS '초대 수락 시 user_store_roles와 store_users에 레코드를 생성하는 함수';

