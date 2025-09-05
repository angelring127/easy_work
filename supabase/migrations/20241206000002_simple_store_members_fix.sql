-- =============================================
-- store_members 보안 이슈 해결 (간단한 함수 버전)
-- =============================================
-- 
-- 뷰는 RLS 정책을 직접 적용할 수 없으므로
-- SECURITY DEFINER 함수를 사용하여 보안 강화

-- 기존 뷰 삭제
DROP VIEW IF EXISTS store_members;

-- 간단한 SECURITY DEFINER 함수 생성
CREATE OR REPLACE FUNCTION get_store_members(p_store_id UUID DEFAULT NULL)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    store_id UUID,
    role VARCHAR(50),
    status VARCHAR(50),
    is_default_store BOOLEAN,
    granted_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    email TEXT,
    name TEXT,
    avatar_url TEXT,
    user_created_at TIMESTAMP WITH TIME ZONE,
    last_sign_in_at TIMESTAMP WITH TIME ZONE,
    temp_start_date DATE,
    temp_end_date DATE,
    temp_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    -- 인증된 사용자인지 확인
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- 매장 구성원 정보 반환 (권한 체크 포함)
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
        u.email,
        u.raw_user_meta_data->>'name' as name,
        u.raw_user_meta_data->>'avatar_url' as avatar_url,
        u.created_at as user_created_at,
        u.last_sign_in_at,
        ta.start_date as temp_start_date,
        ta.end_date as temp_end_date,
        ta.reason as temp_reason
    FROM user_store_roles usr
    JOIN auth.users u ON usr.user_id = u.id
    LEFT JOIN temporary_assignments ta ON usr.user_id = ta.user_id 
        AND usr.store_id = ta.store_id
        AND CURRENT_DATE BETWEEN ta.start_date AND ta.end_date
    WHERE usr.deleted_at IS NULL
    AND (p_store_id IS NULL OR usr.store_id = p_store_id)
    -- 사용자가 접근할 수 있는 매장만 조회
    AND (
        usr.store_id IN (
            SELECT id FROM stores WHERE owner_id = auth.uid()
        )
        OR usr.user_id = auth.uid()
        OR usr.store_id IN (
            SELECT store_id FROM user_store_roles 
            WHERE user_id = auth.uid() AND deleted_at IS NULL
        )
    );
END;
$$;

-- 함수에 대한 권한 설정
GRANT EXECUTE ON FUNCTION get_store_members(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_store_members() TO authenticated;

-- 호환성을 위한 뷰 재생성 (함수 사용)
CREATE OR REPLACE VIEW store_members AS
SELECT * FROM get_store_members();
