-- =============================================
-- deleted_at 컬럼 타임스탬프 오류 수정
-- =============================================

-- user_store_roles 테이블의 deleted_at 컬럼 타입 확인 및 수정
-- 기존 컬럼이 올바르게 정의되어 있는지 확인
DO $$
BEGIN
    -- deleted_at 컬럼이 존재하지 않는 경우에만 추가
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'user_store_roles' 
        AND column_name = 'deleted_at'
    ) THEN
        ALTER TABLE user_store_roles 
        ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
    END IF;
END $$;

-- deleted_at 컬럼에 대한 인덱스가 존재하지 않는 경우에만 생성
CREATE INDEX IF NOT EXISTS idx_user_store_roles_deleted_at 
ON user_store_roles(deleted_at) 
WHERE deleted_at IS NOT NULL;

-- 기존 데이터에서 잘못된 deleted_at 값 정리
-- 문자열 'null'이나 잘못된 형식의 값들을 NULL로 변경
UPDATE user_store_roles 
SET deleted_at = NULL 
WHERE deleted_at IS NOT NULL 
AND (
    deleted_at::text = 'null' 
    OR deleted_at::text = '' 
    OR deleted_at::text = 'undefined'
);

-- RLS 정책에서 deleted_at 필터링 개선
-- 기존 정책이 있다면 삭제 후 재생성
DROP POLICY IF EXISTS "Users can view their store roles" ON user_store_roles;
DROP POLICY IF EXISTS "Store owners can manage store roles" ON user_store_roles;

-- 개선된 RLS 정책 생성
CREATE POLICY "Users can view their active store roles" ON user_store_roles
    FOR SELECT
    USING (
        user_id = auth.uid() 
        AND deleted_at IS NULL
    );

CREATE POLICY "Store owners can manage store roles" ON user_store_roles
    FOR ALL
    USING (
        store_id IN (
            SELECT id FROM stores WHERE owner_id = auth.uid()
        )
    );

-- 함수에서 deleted_at 필터링 개선
CREATE OR REPLACE FUNCTION get_store_members(store_uuid UUID)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    store_id UUID,
    role TEXT,
    status TEXT,
    is_default_store BOOLEAN,
    granted_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        usr.id,
        usr.user_id,
        usr.store_id,
        usr.role,
        usr.status,
        usr.is_default_store,
        usr.granted_at,
        usr.updated_at,
        usr.deleted_at
    FROM user_store_roles usr
    WHERE usr.store_id = store_uuid
    AND usr.deleted_at IS NULL
    ORDER BY usr.granted_at DESC;
END;
$$;

-- 함수 실행 권한 부여
GRANT EXECUTE ON FUNCTION get_store_members(UUID) TO authenticated;
