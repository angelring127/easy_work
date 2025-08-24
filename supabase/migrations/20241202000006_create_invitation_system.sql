-- =============================================
-- 파트타이머 초대 시스템 데이터베이스 스키마
-- =============================================

-- 기존 함수들 삭제 (충돌 방지)
DROP FUNCTION IF EXISTS generate_invite_token();
DROP FUNCTION IF EXISTS create_invitation(UUID, VARCHAR, VARCHAR, INTEGER, UUID);
DROP FUNCTION IF EXISTS accept_invitation(TEXT, UUID);
DROP FUNCTION IF EXISTS cleanup_expired_invitations();

-- 기존 트리거 삭제
DROP TRIGGER IF EXISTS update_invitations_updated_at ON invitations;

-- 기존 정책들 삭제
DROP POLICY IF EXISTS "Store managers can view invitations" ON invitations;
DROP POLICY IF EXISTS "Store managers can create invitations" ON invitations;
DROP POLICY IF EXISTS "Store managers can update invitations" ON invitations;

-- 기존 뷰 삭제
DROP VIEW IF EXISTS invitation_details;

-- invitations 테이블 생성
CREATE TABLE IF NOT EXISTS invitations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  invited_email VARCHAR(255) NOT NULL,
  role_hint VARCHAR(20) NOT NULL DEFAULT 'PART_TIMER' CHECK (role_hint IN ('PART_TIMER', 'SUB_MANAGER')),
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED')),
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  accepted_at TIMESTAMP WITH TIME ZONE,
  accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  -- 한 매장에서 같은 이메일로 동시에 여러 초대 불가
  UNIQUE(store_id, invited_email, status)
);

-- =============================================
-- 인덱스 생성
-- =============================================

CREATE INDEX IF NOT EXISTS idx_invitations_store_id ON invitations(store_id);
CREATE INDEX IF NOT EXISTS idx_invitations_invited_email ON invitations(invited_email);
CREATE INDEX IF NOT EXISTS idx_invitations_token_hash ON invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON invitations(status);
CREATE INDEX IF NOT EXISTS idx_invitations_expires_at ON invitations(expires_at);
CREATE INDEX IF NOT EXISTS idx_invitations_invited_by ON invitations(invited_by);

-- =============================================
-- 트리거 함수: updated_at 자동 업데이트
-- =============================================

CREATE TRIGGER update_invitations_updated_at 
    BEFORE UPDATE ON invitations 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- Row Level Security (RLS) 정책
-- =============================================

-- invitations 테이블 RLS 활성화
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- 매장 관리자만 invitations 조회 가능
CREATE POLICY "Store managers can view invitations" ON invitations
    FOR SELECT USING (
        store_id IN (
            SELECT id FROM stores WHERE owner_id = auth.uid()
        ) OR
        store_id IN (
            SELECT store_id FROM user_store_roles 
            WHERE user_id = auth.uid() AND role IN ('MASTER', 'SUB_MANAGER') AND status = 'ACTIVE'
        )
    );

-- 매장 관리자만 invitations 생성 가능
CREATE POLICY "Store managers can create invitations" ON invitations
    FOR INSERT WITH CHECK (
        store_id IN (
            SELECT id FROM stores WHERE owner_id = auth.uid()
        ) OR
        store_id IN (
            SELECT store_id FROM user_store_roles 
            WHERE user_id = auth.uid() AND role IN ('MASTER', 'SUB_MANAGER') AND status = 'ACTIVE'
        )
    );

-- 매장 관리자만 invitations 수정 가능
CREATE POLICY "Store managers can update invitations" ON invitations
    FOR UPDATE USING (
        store_id IN (
            SELECT id FROM stores WHERE owner_id = auth.uid()
        ) OR
        store_id IN (
            SELECT store_id FROM user_store_roles 
            WHERE user_id = auth.uid() AND role IN ('MASTER', 'SUB_MANAGER') AND status = 'ACTIVE'
        )
    );

-- =============================================
-- 유틸리티 함수
-- =============================================

-- 초대 토큰 생성 함수
CREATE OR REPLACE FUNCTION generate_invite_token()
RETURNS TEXT AS $$
BEGIN
    -- 32자리 랜덤 토큰 생성
    RETURN encode(gen_random_bytes(32), 'hex');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 초대 생성 함수
CREATE OR REPLACE FUNCTION create_invitation(
    p_store_id UUID,
    p_invited_email VARCHAR(255),
    p_role_hint VARCHAR(20) DEFAULT 'PART_TIMER',
    p_expires_in_days INTEGER DEFAULT 7,
    p_invited_by UUID DEFAULT auth.uid()
)
RETURNS UUID AS $$
DECLARE
    invitation_id UUID;
    token_hash TEXT;
BEGIN
    -- 권한 확인: 매장 관리자만 초대 생성 가능
    IF NOT EXISTS (
        SELECT 1 FROM stores 
        WHERE id = p_store_id AND owner_id = p_invited_by
    ) AND NOT EXISTS (
        SELECT 1 FROM user_store_roles 
        WHERE store_id = p_store_id AND user_id = p_invited_by 
        AND role IN ('MASTER', 'SUB_MANAGER') AND status = 'ACTIVE'
    ) THEN
        RAISE EXCEPTION 'Permission denied: Only store managers can create invitations';
    END IF;

    -- 기존 대기 중인 초대 취소
    UPDATE invitations 
    SET status = 'CANCELLED', updated_at = NOW()
    WHERE store_id = p_store_id 
    AND invited_email = p_invited_email 
    AND status = 'PENDING';

    -- 토큰 생성
    token_hash := generate_invite_token();

    -- 초대 생성
    INSERT INTO invitations (
        store_id,
        invited_email,
        role_hint,
        token_hash,
        expires_at,
        invited_by
    ) VALUES (
        p_store_id,
        p_invited_email,
        p_role_hint,
        token_hash,
        NOW() + (p_expires_in_days || ' days')::INTERVAL,
        p_invited_by
    ) RETURNING id INTO invitation_id;
    
    RETURN invitation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 초대 수락 함수
CREATE OR REPLACE FUNCTION accept_invitation(
    p_token_hash TEXT,
    p_accepted_by UUID DEFAULT auth.uid()
)
RETURNS UUID AS $$
DECLARE
    invitation_record invitations%ROWTYPE;
    user_role_id UUID;
BEGIN
    -- 초대 조회
    SELECT * INTO invitation_record 
    FROM invitations 
    WHERE token_hash = p_token_hash 
    AND status = 'PENDING'
    AND expires_at > NOW();

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid or expired invitation token';
    END IF;

    -- 초대 상태 업데이트
    UPDATE invitations 
    SET status = 'ACCEPTED', 
        accepted_at = NOW(), 
        accepted_by = p_accepted_by,
        updated_at = NOW()
    WHERE id = invitation_record.id;

    -- 사용자 역할 부여
    SELECT grant_user_role(
        p_accepted_by,
        invitation_record.store_id,
        invitation_record.role_hint,
        invitation_record.invited_by
    ) INTO user_role_id;
    
    RETURN user_role_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 만료된 초대 정리 함수
CREATE OR REPLACE FUNCTION cleanup_expired_invitations()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    UPDATE invitations 
    SET status = 'EXPIRED', updated_at = NOW()
    WHERE status = 'PENDING' AND expires_at <= NOW();
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 뷰 생성
-- =============================================

-- 초대 상세 정보 뷰 (권한 문제 해결을 위해 단순화)
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
JOIN stores s ON i.store_id = s.id;

-- RLS 정책 적용 (security_invoker = false로 설정)
ALTER VIEW invitation_details SET (security_invoker = false);
