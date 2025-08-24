-- =============================================
-- RLS 정책 무한 재귀 문제 해결
-- =============================================

-- 기존 RLS 정책 삭제
DROP POLICY IF EXISTS "Store managers can view store settings" ON store_settings;
DROP POLICY IF EXISTS "Store managers can update store settings" ON store_settings;
DROP POLICY IF EXISTS "Store owners can create store settings" ON store_settings;
DROP POLICY IF EXISTS "Store managers can view audit logs" ON store_audit_logs;
DROP POLICY IF EXISTS "Users can insert their own audit logs" ON store_audit_logs;
DROP POLICY IF EXISTS "Users can view active stores they own or belong to" ON stores;
DROP POLICY IF EXISTS "Only store owners can update stores" ON stores;
DROP POLICY IF EXISTS "Authenticated users can create stores" ON stores;

-- =============================================
-- 단순화된 RLS 정책 생성
-- =============================================

-- stores 테이블 RLS 정책
-- 1. 소유한 매장 조회
CREATE POLICY "Users can view stores they own" ON stores
    FOR SELECT USING (owner_id = auth.uid());

-- 2. 매장 생성 (인증된 사용자만)
CREATE POLICY "Authenticated users can create stores" ON stores
    FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND owner_id = auth.uid());

-- 3. 매장 수정 (소유자만)
CREATE POLICY "Store owners can update stores" ON stores
    FOR UPDATE USING (owner_id = auth.uid());

-- store_settings 테이블 RLS 정책
-- 1. 매장 소유자만 설정 조회/수정
CREATE POLICY "Store owners can manage store settings" ON store_settings
    FOR ALL USING (
        store_id IN (
            SELECT id FROM stores WHERE owner_id = auth.uid()
        )
    );

-- store_audit_logs 테이블 RLS 정책
-- 1. 자신의 감사 로그만 조회
CREATE POLICY "Users can view their own audit logs" ON store_audit_logs
    FOR SELECT USING (user_id = auth.uid());

-- 2. 감사 로그 생성
CREATE POLICY "Users can insert audit logs" ON store_audit_logs
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- =============================================
-- store_users 테이블 RLS 정책 (기존 정책 유지)
-- =============================================

-- store_users 테이블이 있다면 기존 정책 유지
-- 없다면 나중에 별도 마이그레이션에서 처리

-- =============================================
-- 뷰 수정 (단순화)
-- =============================================

-- 기존 뷰 삭제
DROP VIEW IF EXISTS user_accessible_stores;

-- 단순화된 뷰 생성 (소유한 매장만)
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
    'MASTER' as user_role,
    s.created_at as granted_at,
    ss.business_hours,
    ss.shift_policy,
    ss.chat_policy,
    ss.contact_info
FROM stores s
LEFT JOIN store_settings ss ON s.id = ss.store_id
WHERE s.status = 'ACTIVE' AND s.owner_id = auth.uid();

-- RLS 정책 적용
ALTER VIEW user_accessible_stores SET (security_invoker = true);
