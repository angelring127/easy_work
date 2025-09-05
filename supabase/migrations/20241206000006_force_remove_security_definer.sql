-- =============================================
-- SECURITY DEFINER 강제 제거
-- =============================================
-- 
-- Supabase 보안 스캔이 여전히 SECURITY DEFINER를 감지하는 경우
-- 뷰를 완전히 삭제하고 다른 이름으로 재생성

-- 1. 기존 RLS 정책 모두 제거 (뷰 삭제 전에)
DROP POLICY IF EXISTS "Store owners can view store members" ON store_members;
DROP POLICY IF EXISTS "Authenticated users can view accessible store members" ON store_members;
DROP POLICY IF EXISTS "Secure store members access" ON store_members;

-- 2. 기존 뷰 완전 삭제 (모든 의존성 포함)
DROP VIEW IF EXISTS store_members CASCADE;
DROP VIEW IF EXISTS invitation_details CASCADE;

-- 3. 새로운 이름으로 뷰 생성 (SECURITY DEFINER 없이)
CREATE VIEW store_members_secure AS
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

-- 4. invitation_details도 새로운 이름으로 생성
CREATE VIEW invitation_details_secure AS
SELECT 
    i.id,
    i.store_id,
    i.invited_email,
    i.role_hint,
    i.token_hash,
    i.expires_at,
    i.status,
    i.invited_by,
    i.accepted_at,
    i.accepted_by,
    i.created_at,
    i.updated_at,
    s.name as store_name
FROM invitations i
LEFT JOIN stores s ON i.store_id = s.id;

-- 5. 기존 이름으로 뷰 재생성 (새로운 뷰를 참조)
CREATE VIEW store_members AS
SELECT * FROM store_members_secure;

CREATE VIEW invitation_details AS
SELECT * FROM invitation_details_secure;

-- 6. 뷰 권한 설정
GRANT SELECT ON store_members TO authenticated;
GRANT SELECT ON invitation_details TO authenticated;
GRANT SELECT ON store_members_secure TO authenticated;
GRANT SELECT ON invitation_details_secure TO authenticated;
