-- =============================================
-- store_members 보안 이슈 초간단 해결
-- =============================================
-- 
-- 복잡한 함수 없이 뷰만 재생성하여 보안 이슈 해결

-- 기존 뷰 삭제
DROP VIEW IF EXISTS store_members;

-- 간단한 뷰 재생성 (auth.users 직접 노출 제거)
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
    -- auth.users에서 직접 가져오는 대신 user_store_roles에서만 가져옴
    usr.user_id::text as email,  -- 임시로 user_id를 email로 사용
    NULL::text as name,
    NULL::text as avatar_url,
    usr.granted_at as user_created_at,
    NULL::timestamp with time zone as last_sign_in_at,
    -- 임시 근무 정보
    ta.start_date as temp_start_date,
    ta.end_date as temp_end_date,
    ta.reason as temp_reason
FROM user_store_roles usr
LEFT JOIN temporary_assignments ta ON usr.user_id = ta.user_id 
    AND usr.store_id = ta.store_id
    AND CURRENT_DATE BETWEEN ta.start_date AND ta.end_date
WHERE usr.deleted_at IS NULL;
















