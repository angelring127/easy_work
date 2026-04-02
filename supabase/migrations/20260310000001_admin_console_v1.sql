-- =============================================
-- Platform Admin Console V1
-- =============================================

-- store_audit_logs 확장 (기존 구조 재사용)
ALTER TABLE IF EXISTS store_audit_logs
  ADD COLUMN IF NOT EXISTS actor_role TEXT,
  ADD COLUMN IF NOT EXISTS target_type TEXT,
  ADD COLUMN IF NOT EXISTS target_id TEXT,
  ADD COLUMN IF NOT EXISTS event_type TEXT,
  ADD COLUMN IF NOT EXISTS event_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS severity VARCHAR(20) NOT NULL DEFAULT 'LOW'
    CHECK (severity IN ('HIGH', 'MEDIUM', 'LOW'));

-- 플랫폼 단위 감사 로그
CREATE TABLE IF NOT EXISTS platform_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email TEXT,
  actor_role TEXT,
  action VARCHAR(80) NOT NULL,
  event_type VARCHAR(80) NOT NULL,
  target_type VARCHAR(80),
  target_id TEXT,
  severity VARCHAR(20) NOT NULL DEFAULT 'LOW'
    CHECK (severity IN ('HIGH', 'MEDIUM', 'LOW')),
  event_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_audit_logs_actor_id
  ON platform_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_platform_audit_logs_created_at
  ON platform_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_audit_logs_event_type
  ON platform_audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_platform_audit_logs_severity
  ON platform_audit_logs(severity);

ALTER TABLE platform_audit_logs ENABLE ROW LEVEL SECURITY;

-- 시스템 이상징후 엔티티
CREATE TABLE IF NOT EXISTS admin_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'LOW'
    CHECK (severity IN ('HIGH', 'MEDIUM', 'LOW')),
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'ACK', 'RESOLVED')),
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metric_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
  baseline_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_note TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_anomalies_status
  ON admin_anomalies(status);
CREATE INDEX IF NOT EXISTS idx_admin_anomalies_detected_at
  ON admin_anomalies(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_anomalies_severity
  ON admin_anomalies(severity);

ALTER TABLE admin_anomalies ENABLE ROW LEVEL SECURITY;

-- 기존 트리거 함수 재사용
DO $$ BEGIN
  CREATE TRIGGER trg_admin_anomalies_updated_at
  BEFORE UPDATE ON admin_anomalies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
