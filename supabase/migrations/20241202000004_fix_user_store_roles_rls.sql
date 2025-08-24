-- =============================================
-- user_store_roles 테이블 RLS 정책 수정
-- 무한 재귀 문제 해결
-- =============================================

-- 기존 RLS 정책 삭제
DROP POLICY IF EXISTS "Store managers can view user store roles" ON user_store_roles;
DROP POLICY IF EXISTS "Store owners can manage user store roles" ON user_store_roles;

-- 새로운 RLS 정책 생성 (무한 재귀 방지)
-- 매장 소유자만 user_store_roles 조회 가능
CREATE POLICY "Store owners can view user store roles" ON user_store_roles
    FOR SELECT USING (
        store_id IN (
            SELECT id FROM stores WHERE owner_id = auth.uid()
        )
    );

-- 매장 소유자만 user_store_roles 수정 가능
CREATE POLICY "Store owners can manage user store roles" ON user_store_roles
    FOR ALL USING (
        store_id IN (
            SELECT id FROM stores WHERE owner_id = auth.uid()
        )
    );

-- =============================================
-- temporary_assignments 테이블 RLS 정책 수정
-- =============================================

-- 기존 RLS 정책 삭제
DROP POLICY IF EXISTS "Store managers can view temporary assignments" ON temporary_assignments;
DROP POLICY IF EXISTS "Store owners can manage temporary assignments" ON temporary_assignments;

-- 새로운 RLS 정책 생성 (무한 재귀 방지)
-- 매장 소유자만 temporary_assignments 조회 가능
CREATE POLICY "Store owners can view temporary assignments" ON temporary_assignments
    FOR SELECT USING (
        store_id IN (
            SELECT id FROM stores WHERE owner_id = auth.uid()
        )
    );

-- 매장 소유자만 temporary_assignments 관리 가능
CREATE POLICY "Store owners can manage temporary assignments" ON temporary_assignments
    FOR ALL USING (
        store_id IN (
            SELECT id FROM stores WHERE owner_id = auth.uid()
        )
    );

-- =============================================
-- store_members 뷰 RLS 정책 수정
-- =============================================

-- store_members 뷰의 RLS 정책도 수정
ALTER VIEW store_members SET (security_invoker = false);

-- 뷰에 대한 RLS 정책 생성
CREATE POLICY "Store owners can view store members" ON store_members
    FOR SELECT USING (
        store_id IN (
            SELECT id FROM stores WHERE owner_id = auth.uid()
        )
    );
