-- =============================================
-- 매장 관리 기능 확장을 위한 데이터베이스 스키마
-- =============================================

-- stores 테이블에 새로운 필드 추가
ALTER TABLE IF EXISTS stores 
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'Asia/Seoul' NOT NULL,
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ARCHIVED')) NOT NULL;

-- 매장 설정 테이블 생성
CREATE TABLE IF NOT EXISTS store_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  
  -- 영업시간 설정 (JSON)
  business_hours JSONB DEFAULT '{}' NOT NULL,
  
  -- 교대 규칙 설정 (JSON)
  shift_policy JSONB DEFAULT '{}' NOT NULL,
  
  -- 채팅 설정 (JSON)
  chat_policy JSONB DEFAULT '{}' NOT NULL,
  
  -- 기타 설정
  contact_info JSONB DEFAULT '{}' NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  -- 매장당 하나의 설정만 허용
  UNIQUE(store_id)
);

-- 매장 감사 로그 테이블
CREATE TABLE IF NOT EXISTS store_audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL, -- CREATE, UPDATE, DELETE, ARCHIVE
  table_name VARCHAR(50) NOT NULL, -- stores, store_settings
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- =============================================
-- 인덱스 생성
-- =============================================

-- stores 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_stores_status ON stores(status) WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_stores_timezone ON stores(timezone);

-- store_settings 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_store_settings_store_id ON store_settings(store_id);

-- store_audit_logs 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_store_audit_logs_store_id ON store_audit_logs(store_id);
CREATE INDEX IF NOT EXISTS idx_store_audit_logs_user_id ON store_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_store_audit_logs_created_at ON store_audit_logs(created_at);

-- =============================================
-- 트리거 함수: updated_at 자동 업데이트
-- =============================================

-- store_settings 테이블에 updated_at 트리거 적용
CREATE TRIGGER update_store_settings_updated_at 
    BEFORE UPDATE ON store_settings 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- Row Level Security (RLS) 정책
-- =============================================

-- store_settings 테이블 RLS 활성화
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;

-- 매장 소유자와 해당 매장의 관리자만 설정 조회 가능
CREATE POLICY "Store managers can view store settings" ON store_settings
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

-- 매장 소유자와 SUB_MANAGER만 설정 수정 가능
CREATE POLICY "Store managers can update store settings" ON store_settings
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

-- 매장 소유자만 설정 생성 가능
CREATE POLICY "Store owners can create store settings" ON store_settings
    FOR INSERT WITH CHECK (
        store_id IN (
            SELECT id FROM stores WHERE owner_id = auth.uid()
        )
    );

-- store_audit_logs 테이블 RLS 활성화
ALTER TABLE store_audit_logs ENABLE ROW LEVEL SECURITY;

-- 매장 관련 관리자만 감사 로그 조회 가능
CREATE POLICY "Store managers can view audit logs" ON store_audit_logs
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

-- 인증된 사용자는 자신의 행위를 감사 로그에 기록 가능
CREATE POLICY "Users can insert their own audit logs" ON store_audit_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =============================================
-- 기존 stores 테이블 RLS 정책 업데이트
-- =============================================

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Users can view stores they own or belong to" ON stores;
DROP POLICY IF EXISTS "Only store owners can update stores" ON stores;
DROP POLICY IF EXISTS "Authenticated users can create stores" ON stores;

-- 새로운 정책 생성
-- ACTIVE 상태의 매장만 조회 가능
CREATE POLICY "Users can view active stores they own or belong to" ON stores
    FOR SELECT USING (
        status = 'ACTIVE' AND (
            owner_id = auth.uid() OR
            id IN (
                SELECT store_id FROM store_users 
                WHERE user_id = auth.uid() AND is_active = true
            )
        )
    );

-- 매장 소유자만 수정 가능 (ARCHIVED 상태 변경 포함)
CREATE POLICY "Only store owners can update stores" ON stores
    FOR UPDATE USING (owner_id = auth.uid());

-- 인증된 사용자만 매장 생성 가능
CREATE POLICY "Authenticated users can create stores" ON stores
    FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND owner_id = auth.uid());

-- =============================================
-- 유틸리티 함수
-- =============================================

-- 매장 설정 기본값 생성 함수
CREATE OR REPLACE FUNCTION create_default_store_settings(store_uuid UUID)
RETURNS UUID AS $$
DECLARE
    settings_id UUID;
BEGIN
    INSERT INTO store_settings (
        store_id,
        business_hours,
        shift_policy,
        chat_policy,
        contact_info
    ) VALUES (
        store_uuid,
        '{
            "monday": {"open": "09:00", "close": "18:00", "enabled": true},
            "tuesday": {"open": "09:00", "close": "18:00", "enabled": true},
            "wednesday": {"open": "09:00", "close": "18:00", "enabled": true},
            "thursday": {"open": "09:00", "close": "18:00", "enabled": true},
            "friday": {"open": "09:00", "close": "18:00", "enabled": true},
            "saturday": {"open": "10:00", "close": "17:00", "enabled": true},
            "sunday": {"open": "10:00", "close": "17:00", "enabled": false}
        }'::jsonb,
        '{
            "min_shift_hours": 4,
            "max_shift_hours": 8,
            "break_time_minutes": 30,
            "overtime_threshold_hours": 40
        }'::jsonb,
        '{
            "global_chat_enabled": true,
            "store_chat_enabled": true,
            "announcement_pin_limit": 5,
            "mention_notifications": true
        }'::jsonb,
        '{
            "phone": "",
            "email": "",
            "address": "",
            "website": ""
        }'::jsonb
    ) RETURNING id INTO settings_id;
    
    RETURN settings_id;
END;
$$ LANGUAGE plpgsql;

-- 매장 생성 시 자동으로 기본 설정 생성하는 트리거
CREATE OR REPLACE FUNCTION trigger_create_store_settings()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM create_default_store_settings(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- stores 테이블에 트리거 적용
CREATE TRIGGER create_store_settings_trigger
    AFTER INSERT ON stores
    FOR EACH ROW
    EXECUTE FUNCTION trigger_create_store_settings();

-- 감사 로그 생성 함수
CREATE OR REPLACE FUNCTION log_store_audit(
    p_store_id UUID,
    p_action VARCHAR(50),
    p_table_name VARCHAR(50),
    p_old_values JSONB DEFAULT NULL,
    p_new_values JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO store_audit_logs (
        store_id,
        user_id,
        action,
        table_name,
        old_values,
        new_values,
        ip_address,
        user_agent
    ) VALUES (
        p_store_id,
        auth.uid(),
        p_action,
        p_table_name,
        p_old_values,
        p_new_values,
        inet_client_addr(),
        current_setting('request.headers', true)::json->>'user-agent'
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 뷰 생성
-- =============================================

-- 사용자별 접근 가능한 매장 뷰
CREATE OR REPLACE VIEW user_accessible_stores AS
SELECT 
    s.id,
    s.name,
    s.description,
    s.address,
    s.phone,
    s.timezone,
    s.status,
    s.owner_id,
    s.created_at,
    s.updated_at,
    su.role as user_role,
    su.granted_at,
    ss.business_hours,
    ss.shift_policy,
    ss.chat_policy,
    ss.contact_info
FROM stores s
LEFT JOIN store_users su ON s.id = su.store_id AND su.user_id = auth.uid() AND su.is_active = true
LEFT JOIN store_settings ss ON s.id = ss.store_id
WHERE s.status = 'ACTIVE' AND (
    s.owner_id = auth.uid() OR
    su.id IS NOT NULL
);

-- RLS 정책 적용
ALTER VIEW user_accessible_stores SET (security_invoker = true);
