-- 마이그레이션 확인용 테스트 쿼리
-- 이 쿼리들을 SQL Editor에서 실행해서 테이블이 제대로 생성되었는지 확인하세요

-- 1. 테이블 존재 확인
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('stores', 'store_users', 'invites');

-- 2. 인덱스 확인
SELECT indexname, tablename 
FROM pg_indexes 
WHERE tablename IN ('stores', 'store_users', 'invites');

-- 3. 함수 확인
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('generate_invite_token', 'cleanup_expired_invites');

-- 4. RLS 정책 확인
SELECT tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('stores', 'store_users', 'invites');

-- 5. 토큰 생성 함수 테스트
SELECT generate_invite_token() as sample_token;

