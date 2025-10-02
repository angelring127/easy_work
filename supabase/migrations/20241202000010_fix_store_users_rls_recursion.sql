-- =============================================
-- store_users 테이블 RLS 정책 무한 재귀 문제 해결
-- =============================================

-- 기존 RLS 정책 삭제
DROP POLICY IF EXISTS "Users can view store_users for their stores" ON store_users;
DROP POLICY IF EXISTS "Store owners and sub managers can manage store_users" ON store_users;

-- 단순화된 RLS 정책 생성 (무한 재귀 방지)
-- 1. 자신의 store_users 레코드 조회 가능
CREATE POLICY "Users can view their own store_users" ON store_users
    FOR SELECT USING (user_id = auth.uid());

-- 2. 매장 소유자만 해당 매장의 store_users 조회 가능
CREATE POLICY "Store owners can view store_users for their stores" ON store_users
    FOR SELECT USING (
        store_id IN (
            SELECT id FROM stores WHERE owner_id = auth.uid()
        )
    );

-- 3. 매장 소유자만 store_users 관리 가능
CREATE POLICY "Store owners can manage store_users" ON store_users
    FOR ALL USING (
        store_id IN (
            SELECT id FROM stores WHERE owner_id = auth.uid()
        )
    );

-- =============================================
-- invites 테이블 RLS 정책도 단순화
-- =============================================

-- 기존 RLS 정책 삭제
DROP POLICY IF EXISTS "Store managers can view invites for their stores" ON invites;
DROP POLICY IF EXISTS "Store managers can create invites" ON invites;
DROP POLICY IF EXISTS "Store managers can update invites" ON invites;

-- 단순화된 RLS 정책 생성
-- 1. 매장 소유자만 해당 매장의 초대 조회 가능
CREATE POLICY "Store owners can view invites for their stores" ON invites
    FOR SELECT USING (
        store_id IN (
            SELECT id FROM stores WHERE owner_id = auth.uid()
        )
    );

-- 2. 매장 소유자만 초대 생성 가능
CREATE POLICY "Store owners can create invites" ON invites
    FOR INSERT WITH CHECK (
        store_id IN (
            SELECT id FROM stores WHERE owner_id = auth.uid()
        )
    );

-- 3. 매장 소유자만 초대 수정 가능
CREATE POLICY "Store owners can update invites" ON invites
    FOR UPDATE USING (
        store_id IN (
            SELECT id FROM stores WHERE owner_id = auth.uid()
        )
    );

-- =============================================
-- 초대 정보 조회를 위한 특별 정책 추가
-- =============================================

-- 토큰으로 초대 정보 조회 시 RLS 우회를 위한 함수 생성
CREATE OR REPLACE FUNCTION get_invitation_by_token(p_token VARCHAR)
RETURNS TABLE (
    id UUID,
    store_id UUID,
    invited_email VARCHAR,
    role_hint VARCHAR,
    token_hash VARCHAR,
    expires_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR,
    invited_by UUID,
    accepted_at TIMESTAMP WITH TIME ZONE,
    accepted_by UUID,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
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
        i.updated_at
    FROM invitations i
    WHERE i.token_hash = p_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- invites 테이블용 함수도 생성
CREATE OR REPLACE FUNCTION get_invite_by_token(p_token VARCHAR)
RETURNS TABLE (
    id UUID,
    store_id UUID,
    email VARCHAR,
    role VARCHAR,
    token VARCHAR,
    invited_by UUID,
    invited_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    accepted_at TIMESTAMP WITH TIME ZONE,
    accepted_by UUID,
    is_used BOOLEAN,
    is_cancelled BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.id,
        i.store_id,
        i.email,
        i.role,
        i.token,
        i.invited_by,
        i.invited_at,
        i.expires_at,
        i.accepted_at,
        i.accepted_by,
        i.is_used,
        i.is_cancelled
    FROM invites i
    WHERE i.token = p_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;














