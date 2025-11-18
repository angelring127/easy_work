-- =============================================
-- user_difficult_weekdays 테이블의 외래 키 제약조건 제거
-- 게스트 사용자 지원을 위해 user_id와 created_by의 외래 키 제약조건 제거
-- =============================================

-- 1. user_id 외래 키 제약조건 찾아서 삭제
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- user_difficult_weekdays 테이블의 user_id 외래 키 제약조건 찾아서 삭제
    FOR r IN (
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_name = 'user_difficult_weekdays' 
        AND constraint_type = 'FOREIGN KEY'
        AND constraint_name LIKE '%user_id%'
    ) LOOP
        EXECUTE 'ALTER TABLE user_difficult_weekdays DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name) || ';';
        RAISE NOTICE 'Dropped constraint: %', r.constraint_name;
    END LOOP;
    
    -- created_by 외래 키 제약조건 찾아서 삭제
    FOR r IN (
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_name = 'user_difficult_weekdays' 
        AND constraint_type = 'FOREIGN KEY'
        AND constraint_name LIKE '%created_by%'
    ) LOOP
        EXECUTE 'ALTER TABLE user_difficult_weekdays DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name) || ';';
        RAISE NOTICE 'Dropped constraint: %', r.constraint_name;
    END LOOP;
END $$;

-- 2. 명시적으로 알려진 제약조건 이름들도 삭제 시도 (이전 마이그레이션에서 생성된 것들)
ALTER TABLE user_difficult_weekdays 
  DROP CONSTRAINT IF EXISTS user_preferred_weekdays_user_id_fkey;

ALTER TABLE user_difficult_weekdays 
  DROP CONSTRAINT IF EXISTS user_difficult_weekdays_user_id_fkey;

ALTER TABLE user_difficult_weekdays 
  DROP CONSTRAINT IF EXISTS user_preferred_weekdays_created_by_fkey;

ALTER TABLE user_difficult_weekdays 
  DROP CONSTRAINT IF EXISTS user_difficult_weekdays_created_by_fkey;

