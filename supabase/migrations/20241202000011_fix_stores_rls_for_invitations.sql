-- =============================================
-- Fix stores RLS policies for invited users
-- =============================================

-- 기존 RLS 정책 삭제
DROP POLICY IF EXISTS "Users can view stores they own" ON stores;

-- 새로운 RLS 정책 생성 (소유자 + 초대된 사용자)
CREATE POLICY "Users can view stores they own or are invited to" ON stores
    FOR SELECT USING (
        owner_id = auth.uid() OR
        id IN (
            SELECT store_id 
            FROM user_store_roles 
            WHERE user_id = auth.uid() 
            AND status = 'ACTIVE'
        )
    );

-- 기존 정책들은 유지
-- CREATE POLICY "Authenticated users can create stores" ON stores
-- CREATE POLICY "Store owners can update stores" ON stores
































