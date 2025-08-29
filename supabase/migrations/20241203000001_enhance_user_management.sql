-- =============================================
-- 사용자 관리 기능 개선 마이그레이션
-- =============================================

-- user_store_roles 테이블에 deleted_at 컬럼 추가 (소프트 삭제용)
ALTER TABLE user_store_roles 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- deleted_at 컬럼에 대한 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_user_store_roles_deleted_at ON user_store_roles(deleted_at);

-- =============================================
-- 함수 개선 및 추가
-- =============================================

-- 서브 매니저를 파트타이머로 전환하는 함수 (기존 revoke_user_role 대체)
CREATE OR REPLACE FUNCTION demote_sub_manager_to_part_timer(
    p_user_id UUID,
    p_store_id UUID,
    p_demoted_by UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN AS $$
BEGIN
    -- 권한 확인: 매장 소유자만 역할 변경 가능
    IF NOT EXISTS (
        SELECT 1 FROM stores 
        WHERE id = p_store_id AND owner_id = p_demoted_by
    ) THEN
        RAISE EXCEPTION 'Permission denied: Only store owner can demote sub managers';
    END IF;

    -- 대상 사용자가 서브 매니저인지 확인
    IF NOT EXISTS (
        SELECT 1 FROM user_store_roles 
        WHERE user_id = p_user_id 
        AND store_id = p_store_id 
        AND role = 'SUB_MANAGER'
        AND status = 'ACTIVE'
        AND deleted_at IS NULL
    ) THEN
        RAISE EXCEPTION 'User is not an active sub manager';
    END IF;

    -- 서브 매니저를 파트타이머로 변경
    UPDATE user_store_roles 
    SET 
        role = 'PART_TIMER',
        updated_at = NOW()
    WHERE user_id = p_user_id 
    AND store_id = p_store_id 
    AND role = 'SUB_MANAGER'
    AND status = 'ACTIVE'
    AND deleted_at IS NULL;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 사용자 비활성화 함수
CREATE OR REPLACE FUNCTION deactivate_user(
    p_user_id UUID,
    p_store_id UUID,
    p_deactivated_by UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN AS $$
BEGIN
    -- 권한 확인: 매장 소유자만 사용자 비활성화 가능
    IF NOT EXISTS (
        SELECT 1 FROM stores 
        WHERE id = p_store_id AND owner_id = p_deactivated_by
    ) THEN
        RAISE EXCEPTION 'Permission denied: Only store owner can deactivate users';
    END IF;

    -- 대상 사용자가 활성 상태인지 확인
    IF NOT EXISTS (
        SELECT 1 FROM user_store_roles 
        WHERE user_id = p_user_id 
        AND store_id = p_store_id 
        AND status = 'ACTIVE'
        AND deleted_at IS NULL
    ) THEN
        RAISE EXCEPTION 'User is not active';
    END IF;

    -- 사용자를 비활성화
    UPDATE user_store_roles 
    SET 
        status = 'INACTIVE',
        updated_at = NOW()
    WHERE user_id = p_user_id 
    AND store_id = p_store_id 
    AND status = 'ACTIVE'
    AND deleted_at IS NULL;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 사용자 재활성화 함수
CREATE OR REPLACE FUNCTION reactivate_user(
    p_user_id UUID,
    p_store_id UUID,
    p_reactivated_by UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN AS $$
BEGIN
    -- 권한 확인: 매장 소유자만 사용자 재활성화 가능
    IF NOT EXISTS (
        SELECT 1 FROM stores 
        WHERE id = p_store_id AND owner_id = p_reactivated_by
    ) THEN
        RAISE EXCEPTION 'Permission denied: Only store owner can reactivate users';
    END IF;

    -- 대상 사용자가 비활성 상태인지 확인
    IF NOT EXISTS (
        SELECT 1 FROM user_store_roles 
        WHERE user_id = p_user_id 
        AND store_id = p_store_id 
        AND status = 'INACTIVE'
        AND deleted_at IS NULL
    ) THEN
        RAISE EXCEPTION 'User is not inactive';
    END IF;

    -- 사용자를 재활성화
    UPDATE user_store_roles 
    SET 
        status = 'ACTIVE',
        updated_at = NOW()
    WHERE user_id = p_user_id 
    AND store_id = p_store_id 
    AND status = 'INACTIVE'
    AND deleted_at IS NULL;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 사용자 소프트 삭제 함수 (스케줄 이력 보존)
CREATE OR REPLACE FUNCTION soft_delete_user(
    p_user_id UUID,
    p_store_id UUID,
    p_deleted_by UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN AS $$
BEGIN
    -- 권한 확인: 매장 소유자만 사용자 삭제 가능
    IF NOT EXISTS (
        SELECT 1 FROM stores 
        WHERE id = p_store_id AND owner_id = p_deleted_by
    ) THEN
        RAISE EXCEPTION 'Permission denied: Only store owner can delete users';
    END IF;

    -- 대상 사용자가 존재하는지 확인
    IF NOT EXISTS (
        SELECT 1 FROM user_store_roles 
        WHERE user_id = p_user_id 
        AND store_id = p_store_id 
        AND deleted_at IS NULL
    ) THEN
        RAISE EXCEPTION 'User not found or already deleted';
    END IF;

    -- 사용자를 소프트 삭제 (스케줄 이력은 보존)
    UPDATE user_store_roles 
    SET 
        deleted_at = NOW(),
        updated_at = NOW()
    WHERE user_id = p_user_id 
    AND store_id = p_store_id 
    AND deleted_at IS NULL;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- RLS 정책 업데이트
-- =============================================

-- 삭제된 사용자는 조회하지 않도록 RLS 정책 업데이트
DROP POLICY IF EXISTS "Users can view user_store_roles for their stores" ON user_store_roles;

CREATE POLICY "Users can view active user_store_roles for their stores" ON user_store_roles
    FOR SELECT USING (
        store_id IN (
            SELECT id FROM stores WHERE owner_id = auth.uid()
        )
        AND deleted_at IS NULL
    );

-- =============================================
-- 뷰 업데이트
-- =============================================

-- 매장 구성원 상세 정보 뷰 업데이트 (삭제된 사용자 제외)
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
LEFT JOIN temporary_assignments ta ON usr.user_id = ta.user_id 
    AND usr.store_id = ta.store_id
    AND CURRENT_DATE BETWEEN ta.start_date AND ta.end_date
WHERE usr.deleted_at IS NULL;
