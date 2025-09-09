-- =============================================
-- 운영 규정 단순화: 불필요한 복잡성 제거
-- =============================================

-- Stores 테이블에서 제거할 필드들:
-- - night_shift_boundary_min (야간 근무 경계 시간)
-- - freeze_hours_before_shift (근무 전 동결 시간)
-- - swap_require_same_role (동일 직무 교대 요구)
-- - swap_auto_approve_threshold (자동 승인 임계값)

-- 스케줄 단위 설정 추가
ALTER TABLE stores
  DROP COLUMN IF EXISTS night_shift_boundary_min,
  DROP COLUMN IF EXISTS freeze_hours_before_shift,
  DROP COLUMN IF EXISTS swap_require_same_role,
  DROP COLUMN IF EXISTS swap_auto_approve_threshold,
  ADD COLUMN IF NOT EXISTS schedule_unit TEXT NOT NULL DEFAULT 'week' CHECK (schedule_unit IN ('week', 'month'));

-- 기존 데이터에 대해 schedule_unit 기본값 설정
UPDATE stores SET schedule_unit = 'week' WHERE schedule_unit IS NULL;

-- 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_stores_schedule_unit ON stores(schedule_unit);

-- 주석 추가
COMMENT ON COLUMN stores.schedule_unit IS '스케줄 단위: week(주) 또는 month(월)';
