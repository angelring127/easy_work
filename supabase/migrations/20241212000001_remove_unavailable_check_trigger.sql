-- =============================================
-- Remove unavailable check trigger
-- 출근 불가 체크 트리거 제거 (API 레벨에서 경고로 처리)
-- =============================================

-- 스케줄 배정 시 출근 불가 확인 트리거 제거
DROP TRIGGER IF EXISTS check_assignment_availability_trigger ON schedule_assignments;

-- 트리거 함수는 유지 (필요시 재사용 가능)
-- DROP FUNCTION IF EXISTS check_assignment_availability();

-- 코멘트 업데이트
COMMENT ON FUNCTION check_assignment_availability() IS '출근 불가 체크 함수 (현재 사용 안 함, API 레벨에서 경고로 처리)';

