-- =============================================
-- 초대 삭제 권한 수정
-- =============================================

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Store managers can delete invitations" ON invitations;

-- 매장 관리자만 invitations 삭제 가능
CREATE POLICY "Store managers can delete invitations" ON invitations
    FOR DELETE USING (
        store_id IN (
            SELECT id FROM stores WHERE owner_id = auth.uid()
        ) OR
        store_id IN (
            SELECT store_id FROM user_store_roles 
            WHERE user_id = auth.uid() AND role IN ('MASTER', 'SUB_MANAGER') AND status = 'ACTIVE'
        )
    );
