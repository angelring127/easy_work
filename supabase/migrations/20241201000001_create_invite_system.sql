-- =============================================
-- 파트타이머 초대 시스템을 위한 데이터베이스 스키마
-- =============================================

-- 매장 테이블
CREATE TABLE IF NOT EXISTS stores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  address TEXT,
  phone VARCHAR(50),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL
);

-- 매장-사용자 관계 테이블 (역할 기반)
CREATE TABLE IF NOT EXISTS store_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL CHECK (role IN ('MASTER', 'SUB_MANAGER', 'PART_TIMER')),
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  
  -- 복합 유니크 제약조건 (한 매장에서 사용자는 하나의 활성 역할만 가질 수 있음)
  UNIQUE(store_id, user_id, is_active) DEFERRABLE INITIALLY DEFERRED
);

-- 초대 테이블
CREATE TABLE IF NOT EXISTS invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('SUB_MANAGER', 'PART_TIMER')),
  token VARCHAR(255) NOT NULL UNIQUE,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE,
  accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_used BOOLEAN DEFAULT false NOT NULL,
  is_cancelled BOOLEAN DEFAULT false NOT NULL
);

-- =============================================
-- 인덱스 생성
-- =============================================

-- stores 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_stores_owner_id ON stores(owner_id);
CREATE INDEX IF NOT EXISTS idx_stores_active ON stores(is_active) WHERE is_active = true;

-- store_users 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_store_users_store_id ON store_users(store_id);
CREATE INDEX IF NOT EXISTS idx_store_users_user_id ON store_users(user_id);
CREATE INDEX IF NOT EXISTS idx_store_users_role ON store_users(role);
CREATE INDEX IF NOT EXISTS idx_store_users_active ON store_users(is_active) WHERE is_active = true;

-- invites 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_invites_store_id ON invites(store_id);
CREATE INDEX IF NOT EXISTS idx_invites_email ON invites(email);
CREATE INDEX IF NOT EXISTS idx_invites_token ON invites(token);
CREATE INDEX IF NOT EXISTS idx_invites_expires_at ON invites(expires_at);
CREATE INDEX IF NOT EXISTS idx_invites_not_used ON invites(is_used) WHERE is_used = false;

-- =============================================
-- 트리거 함수: updated_at 자동 업데이트
-- =============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- stores 테이블에 updated_at 트리거 적용
CREATE TRIGGER update_stores_updated_at 
    BEFORE UPDATE ON stores 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- Row Level Security (RLS) 정책
-- =============================================

-- stores 테이블 RLS 활성화
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

-- 매장 소유자와 해당 매장의 사용자만 조회 가능
CREATE POLICY "Users can view stores they own or belong to" ON stores
    FOR SELECT USING (
        owner_id = auth.uid() OR
        id IN (
            SELECT store_id FROM store_users 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

-- 매장 소유자만 수정 가능
CREATE POLICY "Only store owners can update stores" ON stores
    FOR UPDATE USING (owner_id = auth.uid());

-- 인증된 사용자만 매장 생성 가능
CREATE POLICY "Authenticated users can create stores" ON stores
    FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND owner_id = auth.uid());

-- store_users 테이블 RLS 활성화
ALTER TABLE store_users ENABLE ROW LEVEL SECURITY;

-- 매장 관련 사용자만 조회 가능
CREATE POLICY "Users can view store_users for their stores" ON store_users
    FOR SELECT USING (
        user_id = auth.uid() OR
        store_id IN (
            SELECT id FROM stores WHERE owner_id = auth.uid()
        ) OR
        store_id IN (
            SELECT store_id FROM store_users 
            WHERE user_id = auth.uid() AND is_active = true 
            AND role IN ('MASTER', 'SUB_MANAGER')
        )
    );

-- 매장 소유자와 SUB_MANAGER만 사용자 관계 관리 가능
CREATE POLICY "Store owners and sub managers can manage store_users" ON store_users
    FOR ALL USING (
        store_id IN (
            SELECT id FROM stores WHERE owner_id = auth.uid()
        ) OR
        store_id IN (
            SELECT store_id FROM store_users 
            WHERE user_id = auth.uid() AND is_active = true 
            AND role IN ('MASTER', 'SUB_MANAGER')
        )
    );

-- invites 테이블 RLS 활성화
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;

-- 매장 관련 관리자만 초대 조회 가능
CREATE POLICY "Store managers can view invites for their stores" ON invites
    FOR SELECT USING (
        store_id IN (
            SELECT id FROM stores WHERE owner_id = auth.uid()
        ) OR
        store_id IN (
            SELECT store_id FROM store_users 
            WHERE user_id = auth.uid() AND is_active = true 
            AND role IN ('MASTER', 'SUB_MANAGER')
        )
    );

-- 매장 관련 관리자만 초대 생성 가능
CREATE POLICY "Store managers can create invites" ON invites
    FOR INSERT WITH CHECK (
        store_id IN (
            SELECT id FROM stores WHERE owner_id = auth.uid()
        ) OR
        store_id IN (
            SELECT store_id FROM store_users 
            WHERE user_id = auth.uid() AND is_active = true 
            AND role IN ('MASTER', 'SUB_MANAGER')
        )
    );

-- 매장 관련 관리자만 초대 수정 가능
CREATE POLICY "Store managers can update invites" ON invites
    FOR UPDATE USING (
        store_id IN (
            SELECT id FROM stores WHERE owner_id = auth.uid()
        ) OR
        store_id IN (
            SELECT store_id FROM store_users 
            WHERE user_id = auth.uid() AND is_active = true 
            AND role IN ('MASTER', 'SUB_MANAGER')
        )
    );

-- =============================================
-- 유틸리티 함수
-- =============================================

-- 초대 토큰 생성 함수
CREATE OR REPLACE FUNCTION generate_invite_token()
RETURNS VARCHAR(255) AS $$
DECLARE
    token VARCHAR(255);
BEGIN
    -- 32자리 랜덤 토큰 생성 (URL-safe)
    token := encode(gen_random_bytes(24), 'base64');
    -- URL-safe 문자로 변환
    token := replace(replace(token, '+', '-'), '/', '_');
    -- 패딩 제거
    token := rtrim(token, '=');
    RETURN token;
END;
$$ LANGUAGE plpgsql;

-- 만료된 초대 정리 함수
CREATE OR REPLACE FUNCTION cleanup_expired_invites()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM invites 
    WHERE expires_at < TIMEZONE('utc'::text, NOW()) 
    AND is_used = false 
    AND is_cancelled = false;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 초기 데이터 (테스트용)
-- =============================================

-- 이 부분은 실제 배포시에는 제거하거나 주석 처리
-- 개발/테스트 환경에서만 사용
/* 
INSERT INTO stores (name, description, owner_id) VALUES 
('테스트 카페', '개발용 테스트 매장', '00000000-0000-0000-0000-000000000000');
*/




