-- =============================================
-- store_users 테이블에 게스트 사용자 지원 추가
-- =============================================

-- 1. user_id 컬럼을 NULL 허용으로 변경
ALTER TABLE store_users 
  ALTER COLUMN user_id DROP NOT NULL;

-- 2. name 컬럼 추가 (게스트 사용자 이름 저장)
ALTER TABLE store_users 
  ADD COLUMN IF NOT EXISTS name VARCHAR(255);

-- 3. is_guest 컬럼 추가 (게스트 사용자 구분)
ALTER TABLE store_users 
  ADD COLUMN IF NOT EXISTS is_guest BOOLEAN DEFAULT false NOT NULL;

-- 4. 기존 UNIQUE 제약조건 삭제
ALTER TABLE store_users 
  DROP CONSTRAINT IF EXISTS store_users_store_id_user_id_is_active_key;

-- 5. 새로운 UNIQUE 제약조건 생성
-- 일반 사용자용: (store_id, user_id, is_active) 조합으로 유니크 (user_id가 NULL이 아닌 경우)
CREATE UNIQUE INDEX IF NOT EXISTS store_users_unique_active_user 
  ON store_users (store_id, user_id, is_active) 
  WHERE is_active = true AND user_id IS NOT NULL;

-- 게스트 사용자용: (store_id, name, is_active) 조합으로 유니크 (user_id가 NULL인 경우)
CREATE UNIQUE INDEX IF NOT EXISTS store_users_unique_active_guest 
  ON store_users (store_id, name, is_active) 
  WHERE is_active = true AND user_id IS NULL AND is_guest = true;

-- 6. 게스트 사용자 제약조건 추가
-- 게스트 사용자는 user_id가 NULL이고 name이 필수
-- 기존 제약조건이 있으면 삭제 후 재생성
ALTER TABLE store_users 
  DROP CONSTRAINT IF EXISTS store_users_guest_check;

ALTER TABLE store_users 
  ADD CONSTRAINT store_users_guest_check 
  CHECK (
    (is_guest = true AND user_id IS NULL AND name IS NOT NULL) OR
    (is_guest = false AND user_id IS NOT NULL)
  );

-- 7. 기존 RLS 정책 삭제
DROP POLICY IF EXISTS "Users can view their own store_users" ON store_users;
DROP POLICY IF EXISTS "Store owners can view store_users for their stores" ON store_users;
DROP POLICY IF EXISTS "Store owners can manage store_users" ON store_users;
DROP POLICY IF EXISTS "Sub managers can view store_users for their stores" ON store_users;
DROP POLICY IF EXISTS "Sub managers can manage part_timer store_users" ON store_users;

-- 8. 새로운 RLS 정책 생성 (게스트 사용자 포함)
-- 8.1 자신의 store_users 레코드 조회 가능
CREATE POLICY "Users can view their own store_users" ON store_users
    FOR SELECT USING (user_id = auth.uid());

-- 8.2 매장 소유자만 해당 매장의 store_users 조회 가능 (게스트 포함)
CREATE POLICY "Store owners can view store_users for their stores" ON store_users
    FOR SELECT USING (
        store_id IN (
            SELECT id FROM stores WHERE owner_id = auth.uid()
        )
    );

-- 8.3 서브 매니저도 해당 매장의 store_users 조회 가능 (게스트 포함)
CREATE POLICY "Sub managers can view store_users for their stores" ON store_users
    FOR SELECT USING (
        store_id IN (
            SELECT store_id FROM user_store_roles
            WHERE user_id = auth.uid()
            AND role IN ('SUB_MANAGER')
            AND status = 'ACTIVE'
        )
    );

-- 8.4 매장 소유자만 store_users 관리 가능 (게스트 포함)
CREATE POLICY "Store owners can manage store_users" ON store_users
    FOR ALL USING (
        store_id IN (
            SELECT id FROM stores WHERE owner_id = auth.uid()
        )
    );

-- 8.5 서브 매니저도 store_users 관리 가능 (게스트 포함, PART_TIMER만)
CREATE POLICY "Sub managers can manage part_timer store_users" ON store_users
    FOR ALL USING (
        role = 'PART_TIMER' AND
        store_id IN (
            SELECT store_id FROM user_store_roles
            WHERE user_id = auth.uid()
            AND role IN ('SUB_MANAGER')
            AND status = 'ACTIVE'
        )
    );

-- 9. 인덱스 추가 (게스트 사용자 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_store_users_is_guest ON store_users(is_guest) WHERE is_guest = true;
CREATE INDEX IF NOT EXISTS idx_store_users_name ON store_users(name) WHERE name IS NOT NULL;

-- 10. 게스트 사용자 메타데이터 필드 추가 (퇴사 예정일, 희망 근무 시간 등 저장)
ALTER TABLE store_users 
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 11. user_difficult_weekdays 테이블에 게스트 사용자 지원 추가 (테이블 이름은 이후 마이그레이션에서 변경됨)
-- 11.1 외래 키 제약조건 삭제 (제약조건 이름 확인 필요)
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- user_id 외래 키 제약조건 찾아서 삭제
    FOR r IN (
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_name = 'user_preferred_weekdays' OR table_name = 'user_difficult_weekdays' 
        AND constraint_type = 'FOREIGN KEY'
        AND constraint_name LIKE '%user_id%'
    ) LOOP
        EXECUTE 'ALTER TABLE IF EXISTS user_preferred_weekdays DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name) || ';';
        EXECUTE 'ALTER TABLE IF EXISTS user_difficult_weekdays DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name) || ';';
    END LOOP;
    
    -- created_by 외래 키 제약조건 찾아서 삭제
    FOR r IN (
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_name = 'user_preferred_weekdays' OR table_name = 'user_difficult_weekdays' 
        AND constraint_type = 'FOREIGN KEY'
        AND constraint_name LIKE '%created_by%'
    ) LOOP
        EXECUTE 'ALTER TABLE IF EXISTS user_preferred_weekdays DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name) || ';';
        EXECUTE 'ALTER TABLE IF EXISTS user_difficult_weekdays DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name) || ';';
    END LOOP;
END $$;

-- 11.2 user_id를 NULL 허용으로 변경 (게스트 사용자 지원)
DO $$ 
BEGIN
    -- user_preferred_weekdays 또는 user_difficult_weekdays 테이블에 적용
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_preferred_weekdays') THEN
        ALTER TABLE user_preferred_weekdays ALTER COLUMN user_id DROP NOT NULL;
        ALTER TABLE user_preferred_weekdays ALTER COLUMN created_by DROP NOT NULL;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_difficult_weekdays') THEN
        ALTER TABLE user_difficult_weekdays ALTER COLUMN user_id DROP NOT NULL;
        ALTER TABLE user_difficult_weekdays ALTER COLUMN created_by DROP NOT NULL;
    END IF;
END $$;

-- 11.4 기존 UNIQUE 제약조건 삭제
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_preferred_weekdays') THEN
        ALTER TABLE user_preferred_weekdays 
          DROP CONSTRAINT IF EXISTS user_preferred_weekdays_store_id_user_id_weekday_key;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_difficult_weekdays') THEN
        ALTER TABLE user_difficult_weekdays 
          DROP CONSTRAINT IF EXISTS user_difficult_weekdays_store_id_user_id_weekday_key;
    END IF;
END $$;

-- 11.5 새로운 UNIQUE 제약조건 생성 (일반 사용자와 게스트 사용자 모두 지원)
-- user_id가 NULL이 아닌 경우에만 유니크 제약 적용 (일반 사용자와 게스트 사용자 모두)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_preferred_weekdays') THEN
        CREATE UNIQUE INDEX IF NOT EXISTS user_preferred_weekdays_unique 
          ON user_preferred_weekdays (store_id, user_id, weekday) 
          WHERE user_id IS NOT NULL;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_difficult_weekdays') THEN
        CREATE UNIQUE INDEX IF NOT EXISTS user_difficult_weekdays_unique 
          ON user_difficult_weekdays (store_id, user_id, weekday) 
          WHERE user_id IS NOT NULL;
    END IF;
END $$;

-- 11.6 RLS 정책 업데이트 (게스트 사용자 지원)
-- user_preferred_weekdays 테이블용 (이후 마이그레이션에서 이름 변경됨)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_preferred_weekdays') THEN
        DROP POLICY IF EXISTS "Users can view their own preferred weekdays" ON user_preferred_weekdays;
        DROP POLICY IF EXISTS "Managers can manage preferred weekdays" ON user_preferred_weekdays;

        CREATE POLICY "Users can view their own preferred weekdays" ON user_preferred_weekdays
          FOR SELECT USING (
            (user_id IS NOT NULL AND auth.uid() = user_id) OR 
            EXISTS (
              SELECT 1 FROM user_store_roles usr 
              WHERE usr.user_id = auth.uid() 
              AND usr.store_id = user_preferred_weekdays.store_id 
              AND usr.role IN ('MASTER', 'SUB_MANAGER')
              AND usr.status = 'ACTIVE'
            ) OR
            EXISTS (
              SELECT 1 FROM store_users su
              WHERE su.id = user_preferred_weekdays.user_id
              AND su.store_id = user_preferred_weekdays.store_id
              AND su.is_guest = true
              AND EXISTS (
                SELECT 1 FROM user_store_roles usr 
                WHERE usr.user_id = auth.uid() 
                AND usr.store_id = user_preferred_weekdays.store_id 
                AND usr.role IN ('MASTER', 'SUB_MANAGER')
                AND usr.status = 'ACTIVE'
              )
            )
          );

        CREATE POLICY "Managers can manage preferred weekdays" ON user_preferred_weekdays
          FOR ALL USING (
            EXISTS (
              SELECT 1 FROM user_store_roles usr 
              WHERE usr.user_id = auth.uid() 
              AND usr.store_id = user_preferred_weekdays.store_id 
              AND usr.role IN ('MASTER', 'SUB_MANAGER')
              AND usr.status = 'ACTIVE'
            )
          );
    END IF;
    
    -- user_difficult_weekdays 테이블용
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_difficult_weekdays') THEN
        DROP POLICY IF EXISTS "Users can view their own difficult weekdays" ON user_difficult_weekdays;
        DROP POLICY IF EXISTS "Managers can manage difficult weekdays" ON user_difficult_weekdays;

        CREATE POLICY "Users can view their own difficult weekdays" ON user_difficult_weekdays
          FOR SELECT USING (
            (user_id IS NOT NULL AND auth.uid() = user_id) OR 
            EXISTS (
              SELECT 1 FROM user_store_roles usr 
              WHERE usr.user_id = auth.uid() 
              AND usr.store_id = user_difficult_weekdays.store_id 
              AND usr.role IN ('MASTER', 'SUB_MANAGER')
              AND usr.status = 'ACTIVE'
            ) OR
            EXISTS (
              SELECT 1 FROM store_users su
              WHERE su.id = user_difficult_weekdays.user_id
              AND su.store_id = user_difficult_weekdays.store_id
              AND su.is_guest = true
              AND EXISTS (
                SELECT 1 FROM user_store_roles usr 
                WHERE usr.user_id = auth.uid() 
                AND usr.store_id = user_difficult_weekdays.store_id 
                AND usr.role IN ('MASTER', 'SUB_MANAGER')
                AND usr.status = 'ACTIVE'
              )
            )
          );

        CREATE POLICY "Managers can manage difficult weekdays" ON user_difficult_weekdays
          FOR ALL USING (
            EXISTS (
              SELECT 1 FROM user_store_roles usr 
              WHERE usr.user_id = auth.uid() 
              AND usr.store_id = user_difficult_weekdays.store_id 
              AND usr.role IN ('MASTER', 'SUB_MANAGER')
              AND usr.status = 'ACTIVE'
            )
          );
    END IF;
END $$;

