-- =============================================
-- 야간 근무 지원을 위한 store_business_hours 테이블 제약조건 수정
-- =============================================

-- 기존 제약조건 제거 (여러 가능한 이름 시도)
ALTER TABLE store_business_hours 
DROP CONSTRAINT IF EXISTS store_business_hours_check;

ALTER TABLE store_business_hours 
DROP CONSTRAINT IF EXISTS store_business_hours_close_min_check;

-- 테이블의 모든 CHECK 제약조건 확인 및 제거
DO $$
DECLARE
    constraint_name text;
BEGIN
    -- close_min 관련 CHECK 제약조건 찾기 및 제거
    FOR constraint_name IN 
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'store_business_hours'::regclass 
        AND contype = 'c' 
        AND pg_get_constraintdef(oid) LIKE '%close_min%'
    LOOP
        EXECUTE 'ALTER TABLE store_business_hours DROP CONSTRAINT IF EXISTS ' || constraint_name;
        RAISE NOTICE 'Dropped constraint: %', constraint_name;
    END LOOP;
END $$;

-- 새로운 제약조건 추가 (시작 시간과 종료 시간이 같으면 안됨)
ALTER TABLE store_business_hours 
ADD CONSTRAINT store_business_hours_time_check 
CHECK (close_min BETWEEN 0 AND 1440 AND open_min BETWEEN 0 AND 1440 AND close_min != open_min);

-- 기존 데이터 확인 및 로그
DO $$
DECLARE
    invalid_count INTEGER;
BEGIN
    -- 시작 시간과 종료 시간이 같은 레코드가 있는지 확인
    SELECT COUNT(*) INTO invalid_count 
    FROM store_business_hours 
    WHERE open_min = close_min;
    
    IF invalid_count > 0 THEN
        RAISE NOTICE 'Warning: Found % records with open_min = close_min. These will need to be fixed.', invalid_count;
    END IF;
END $$;
