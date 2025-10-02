-- =============================================
-- store_members 보안 이슈 해결
-- =============================================
-- 
-- 문제: store_members 뷰가 auth.users 데이터를 직접 노출하여
-- anon/authenticated 역할에서 접근 가능한 보안 취약점 발생
-- 
-- 해결: 뷰를 SECURITY DEFINER 함수로 대체하여 
-- auth.users 데이터 접근을 제어

-- 기존 뷰 삭제
DROP VIEW IF EXISTS store_members;

-- store_members 데이터를 반환하는 보안 함수 생성
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

    -- 매장 ID가 제공된 경우, 해당 매장에 대한 권한 확인
    IF p_store_id IS NOT NULL THEN
        -- 매장 소유자이거나 해당 매장의 구성원인지 확인
        IF NOT EXISTS (
            SELECT 1 FROM stores 
            WHERE id = p_store_id AND owner_id = auth.uid()
        ) AND NOT EXISTS (
            SELECT 1 FROM user_store_roles 
            WHERE store_id = p_store_id 
            AND user_id = auth.uid() 
            AND deleted_at IS NULL
        ) THEN
            RAISE EXCEPTION 'Permission denied: Access to store members';
        END IF;
    END IF;

    -- 매장 구성원 정보 반환
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
        -- 임시 근무 정보
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

-- 기존 RLS 정책 제거 (뷰가 삭제되었으므로)
DROP POLICY IF EXISTS "Store owners can view store members" ON store_members;

-- =============================================
-- 호환성을 위한 뷰 재생성 (보안 강화)
-- =============================================
-- 
-- 기존 코드와의 호환성을 위해 뷰를 다시 생성하되,
-- 이번에는 SECURITY DEFINER 함수를 사용하여 보안을 강화

CREATE OR REPLACE VIEW store_members AS
SELECT * FROM get_store_members();

-- 뷰에 대한 RLS 정책 설정
ALTER VIEW store_members SET (security_invoker = false);

-- 뷰에 대한 RLS 정책 생성 (보안 강화)
CREATE POLICY "Authenticated users can view accessible store members" ON store_members
    FOR SELECT USING (
        -- 인증된 사용자만 접근 가능
        auth.uid() IS NOT NULL
        AND (
            -- 매장 소유자인 경우
            store_id IN (
                SELECT id FROM stores WHERE owner_id = auth.uid()
            )
            -- 또는 해당 매장의 구성원인 경우
            OR store_id IN (
                SELECT store_id FROM user_store_roles 
                WHERE user_id = auth.uid() AND deleted_at IS NULL
            )
            -- 또는 본인의 정보인 경우
            OR user_id = auth.uid()
        )
    );

-- =============================================
-- 추가 보안 강화: 함수 기반 접근만 허용
-- =============================================
-- 
-- 더 강력한 보안을 위해 뷰를 완전히 제거하고 
-- 함수 기반 접근만 허용하는 옵션

-- 주석 처리: 필요시 아래 주석을 해제하여 뷰를 완전히 제거
-- DROP VIEW IF EXISTS store_members;

-- =============================================
-- 사용 예시 및 문서화
-- =============================================
-- 
-- 사용법:
-- 1. 특정 매장의 구성원 조회: SELECT * FROM get_store_members('store-uuid');
-- 2. 접근 가능한 모든 매장 구성원 조회: SELECT * FROM get_store_members();
-- 3. 기존 뷰 사용 (호환성): SELECT * FROM store_members WHERE store_id = 'store-uuid';











