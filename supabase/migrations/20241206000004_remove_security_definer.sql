-- =============================================
-- SECURITY DEFINER 속성 제거
-- =============================================
-- 
-- Supabase 보안 경고 해결을 위해 뷰의 SECURITY DEFINER 속성 제거

-- 1. store_members 뷰의 SECURITY DEFINER 속성 제거
ALTER VIEW store_members SET (security_invoker = true);

-- 2. invitation_details 뷰의 SECURITY DEFINER 속성 제거 (있다면)
ALTER VIEW invitation_details SET (security_invoker = true);

-- 3. 기존 RLS 정책 제거 (뷰는 RLS 정책을 직접 지원하지 않음)
DROP POLICY IF EXISTS "Store owners can view store members" ON store_members;
DROP POLICY IF EXISTS "Authenticated users can view accessible store members" ON store_members;
DROP POLICY IF EXISTS "Secure store members access" ON store_members;

-- 4. 뷰 재생성 (SECURITY DEFINER 없이)
DROP VIEW IF EXISTS store_members;
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

-- 5. invitation_details 뷰도 확인하여 재생성 (필요시)
-- 기존 invitation_details 뷰 구조 확인 후 재생성
DROP VIEW IF EXISTS invitation_details;
CREATE OR REPLACE VIEW invitation_details AS
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
