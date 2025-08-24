-- =============================================
-- 매장 생성 시 마스터를 user_store_roles에 자동 추가
-- =============================================

-- 매장 생성 후 마스터를 user_store_roles에 추가하는 함수
CREATE OR REPLACE FUNCTION add_master_to_user_store_roles()
RETURNS TRIGGER AS $$
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
    ) ON CONFLICT (user_id, store_id) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- stores 테이블에 AFTER INSERT 트리거 추가
DROP TRIGGER IF EXISTS trigger_add_master_to_user_store_roles ON stores;
CREATE TRIGGER trigger_add_master_to_user_store_roles
    AFTER INSERT ON stores
    FOR EACH ROW
    EXECUTE FUNCTION add_master_to_user_store_roles();

-- 기존 매장들에 대해 마스터 추가 (한 번만 실행)
INSERT INTO user_store_roles (
    user_id,
    store_id,
    role,
    status,
    is_default_store,
    granted_at
)
SELECT 
    owner_id,
    id,
    'MASTER',
    'ACTIVE',
    true,
    created_at
FROM stores
WHERE status = 'ACTIVE'
ON CONFLICT (user_id, store_id) DO NOTHING;
