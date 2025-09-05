-- =============================================
-- 뷰 완전 제거 - API에서 직접 테이블 조회
-- =============================================
-- 
-- Supabase가 뷰에 자동으로 SECURITY DEFINER를 추가하므로
-- 뷰를 완전히 제거하고 API에서 직접 테이블을 조회하도록 변경

-- 1. 기존 RLS 정책 모두 제거 (뷰 삭제 전에)
DROP POLICY IF EXISTS "Store owners can view store members" ON store_members;
DROP POLICY IF EXISTS "Authenticated users can view accessible store members" ON store_members;
DROP POLICY IF EXISTS "Secure store members access" ON store_members;

-- 2. 모든 뷰 완전 삭제
DROP VIEW IF EXISTS store_members CASCADE;
DROP VIEW IF EXISTS invitation_details CASCADE;
DROP VIEW IF EXISTS store_members_secure CASCADE;
DROP VIEW IF EXISTS invitation_details_secure CASCADE;

-- 3. 뷰 관련 함수들도 정리 (필요시)
-- DROP FUNCTION IF EXISTS get_store_members(UUID);
-- DROP FUNCTION IF EXISTS get_store_members();

-- 4. 테이블 권한 확인 (API에서 직접 조회할 수 있도록)
GRANT SELECT ON user_store_roles TO authenticated;
GRANT SELECT ON temporary_assignments TO authenticated;
GRANT SELECT ON invitations TO authenticated;
GRANT SELECT ON stores TO authenticated;
