-- =============================================
-- schedule_assignments 테이블을 Guest 사용자 지원하도록 수정
-- =============================================

-- 1. 기존 외래 키 제약조건 삭제
ALTER TABLE schedule_assignments 
  DROP CONSTRAINT IF EXISTS schedule_assignments_user_id_fkey;

-- 2. user_id 컬럼을 store_users.id를 참조하도록 변경
-- 먼저 기존 데이터를 마이그레이션 (일반 사용자의 경우 store_users.id 찾기)
DO $$
DECLARE
  assignment_record RECORD;
  store_user_id UUID;
  migration_count INTEGER := 0;
  error_count INTEGER := 0;
BEGIN
  -- 기존 schedule_assignments의 user_id가 auth.users.id를 참조하고 있으므로
  -- store_users 테이블에서 해당 user_id를 가진 레코드의 id를 찾아서 업데이트
  FOR assignment_record IN 
    SELECT sa.id, sa.user_id, sa.store_id
    FROM schedule_assignments sa
    WHERE sa.user_id IS NOT NULL
      -- store_users.id가 아닌 경우만 마이그레이션 (auth.users.id인 경우)
      AND NOT EXISTS (
        SELECT 1 FROM store_users su 
        WHERE su.id = sa.user_id 
        AND su.store_id = sa.store_id
      )
  LOOP
    -- store_users에서 해당 user_id(auth.users.id)와 store_id를 가진 레코드 찾기
    -- is_active 체크 제거 (비활성 사용자도 포함)
    SELECT id INTO store_user_id
    FROM store_users
    WHERE user_id = assignment_record.user_id
      AND store_id = assignment_record.store_id
    ORDER BY is_active DESC, granted_at DESC
    LIMIT 1;
    
    -- store_user_id를 찾았으면 업데이트
    IF store_user_id IS NOT NULL THEN
      UPDATE schedule_assignments
      SET user_id = store_user_id
      WHERE id = assignment_record.id;
      migration_count := migration_count + 1;
    ELSE
      -- store_users에 해당 사용자가 없으면 에러 로그
      RAISE WARNING 'Cannot find store_users record for user_id: %, store_id: %, assignment_id: %', 
        assignment_record.user_id, assignment_record.store_id, assignment_record.id;
      error_count := error_count + 1;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Migration completed: % records migrated, % errors', migration_count, error_count;
END $$;

-- 3. 마이그레이션되지 않은 데이터 확인 및 정리
-- store_users에 없는 user_id를 가진 레코드 삭제 (데이터 정합성 유지)
DELETE FROM schedule_assignments
WHERE user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM store_users su 
    WHERE su.id = schedule_assignments.user_id
  );

-- 4. 새로운 외래 키 제약조건 추가 (store_users.id 참조)
ALTER TABLE schedule_assignments
  ADD CONSTRAINT schedule_assignments_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES store_users(id) ON DELETE CASCADE;

-- 5. RLS 정책 수정: Guest 사용자 지원
-- 기존 정책 삭제
DROP POLICY IF EXISTS "Users can view own assignments" ON schedule_assignments;
DROP POLICY IF EXISTS "Store managers can view all assignments" ON schedule_assignments;
DROP POLICY IF EXISTS "Store managers can manage all assignments" ON schedule_assignments;

-- 새로운 정책: 일반 사용자는 본인의 스케줄 조회 가능
CREATE POLICY "Users can view own assignments" ON schedule_assignments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM store_users su
      WHERE su.id = schedule_assignments.user_id
        AND su.user_id = auth.uid()
        AND su.is_active = true
    )
  );

-- 새로운 정책: 매장 관리자는 해당 매장의 모든 스케줄 조회 가능
CREATE POLICY "Store managers can view all assignments" ON schedule_assignments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_store_roles usr
      WHERE usr.store_id = schedule_assignments.store_id
        AND usr.user_id = auth.uid()
        AND usr.role IN ('MASTER', 'SUB', 'SUB_MANAGER')
        AND usr.status = 'ACTIVE'
    )
  );

-- 새로운 정책: 매장 관리자는 해당 매장의 모든 스케줄 관리 가능
CREATE POLICY "Store managers can manage all assignments" ON schedule_assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_store_roles usr
      WHERE usr.store_id = schedule_assignments.store_id
        AND usr.user_id = auth.uid()
        AND usr.role IN ('MASTER', 'SUB', 'SUB_MANAGER')
        AND usr.status = 'ACTIVE'
    )
  );

-- 6. user_availability 테이블도 동일하게 수정 (Guest 사용자 지원)
ALTER TABLE user_availability 
  DROP CONSTRAINT IF EXISTS user_availability_user_id_fkey;

-- user_availability 데이터 마이그레이션
DO $$
DECLARE
  availability_record RECORD;
  store_user_id UUID;
  migration_count INTEGER := 0;
  error_count INTEGER := 0;
BEGIN
  FOR availability_record IN 
    SELECT ua.id, ua.user_id, ua.store_id
    FROM user_availability ua
    WHERE ua.user_id IS NOT NULL
      -- store_users.id가 아닌 경우만 마이그레이션 (auth.users.id인 경우)
      AND NOT EXISTS (
        SELECT 1 FROM store_users su 
        WHERE su.id = ua.user_id 
        AND su.store_id = ua.store_id
      )
  LOOP
    -- store_users에서 해당 user_id(auth.users.id)와 store_id를 가진 레코드 찾기
    -- is_active 체크 제거 (비활성 사용자도 포함)
    SELECT id INTO store_user_id
    FROM store_users
    WHERE user_id = availability_record.user_id
      AND store_id = availability_record.store_id
    ORDER BY is_active DESC, granted_at DESC
    LIMIT 1;
    
    IF store_user_id IS NOT NULL THEN
      UPDATE user_availability
      SET user_id = store_user_id
      WHERE id = availability_record.id;
      migration_count := migration_count + 1;
    ELSE
      -- store_users에 해당 사용자가 없으면 에러 로그
      RAISE WARNING 'Cannot find store_users record for user_id: %, store_id: %, availability_id: %', 
        availability_record.user_id, availability_record.store_id, availability_record.id;
      error_count := error_count + 1;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'User availability migration completed: % records migrated, % errors', migration_count, error_count;
END $$;

-- user_availability 마이그레이션되지 않은 데이터 정리
DELETE FROM user_availability
WHERE user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM store_users su 
    WHERE su.id = user_availability.user_id
  );

-- user_availability 외래 키 제약조건 추가
ALTER TABLE user_availability
  ADD CONSTRAINT user_availability_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES store_users(id) ON DELETE CASCADE;

-- user_availability RLS 정책 수정
DROP POLICY IF EXISTS "Users can view own availability" ON user_availability;
DROP POLICY IF EXISTS "Users can insert own availability" ON user_availability;
DROP POLICY IF EXISTS "Users can update own availability" ON user_availability;
DROP POLICY IF EXISTS "Users can delete own availability" ON user_availability;
DROP POLICY IF EXISTS "Store managers can view all availability" ON user_availability;
DROP POLICY IF EXISTS "Store managers can manage all availability" ON user_availability;

-- 일반 사용자는 본인의 출근 불가 데이터 조회/수정/삭제 가능
CREATE POLICY "Users can view own availability" ON user_availability
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM store_users su
      WHERE su.id = user_availability.user_id
        AND su.user_id = auth.uid()
        AND su.is_active = true
    )
  );

CREATE POLICY "Users can insert own availability" ON user_availability
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM store_users su
      WHERE su.id = user_availability.user_id
        AND su.user_id = auth.uid()
        AND su.is_active = true
    )
    AND auth.uid() = created_by
  );

CREATE POLICY "Users can update own availability" ON user_availability
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM store_users su
      WHERE su.id = user_availability.user_id
        AND su.user_id = auth.uid()
        AND su.is_active = true
    )
  );

CREATE POLICY "Users can delete own availability" ON user_availability
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM store_users su
      WHERE su.id = user_availability.user_id
        AND su.user_id = auth.uid()
        AND su.is_active = true
    )
  );

-- 매장 관리자는 해당 매장의 모든 출근 불가 데이터 조회/수정/삭제 가능
CREATE POLICY "Store managers can view all availability" ON user_availability
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_store_roles usr
      WHERE usr.store_id = user_availability.store_id
        AND usr.user_id = auth.uid()
        AND usr.role IN ('MASTER', 'SUB', 'SUB_MANAGER')
        AND usr.status = 'ACTIVE'
    )
  );

CREATE POLICY "Store managers can manage all availability" ON user_availability
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_store_roles usr
      WHERE usr.store_id = user_availability.store_id
        AND usr.user_id = auth.uid()
        AND usr.role IN ('MASTER', 'SUB', 'SUB_MANAGER')
        AND usr.status = 'ACTIVE'
    )
  );

-- 7. 트리거 함수 수정 (user_id가 store_users.id를 참조하도록)
-- check_assignment_availability 함수는 그대로 사용 가능 (user_id 비교만 하면 됨)

-- 코멘트 업데이트
COMMENT ON TABLE schedule_assignments IS '스케줄 배정 관리 (store_users.id 참조, Guest 사용자 지원)';
COMMENT ON TABLE user_availability IS '사용자 출근 불가 날짜 관리 (store_users.id 참조, Guest 사용자 지원)';

