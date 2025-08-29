-- 매장별 invites 테이블 조회를 위한 RPC 함수
CREATE OR REPLACE FUNCTION get_invites_by_store(p_store_id UUID)
RETURNS TABLE (
  id UUID,
  store_id UUID,
  email TEXT,
  role TEXT,
  token TEXT,
  is_used BOOLEAN,
  is_cancelled BOOLEAN,
  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  invited_by UUID,
  accepted_at TIMESTAMPTZ,
  accepted_by UUID
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.id,
    i.store_id,
    i.email,
    i.role,
    i.token,
    i.is_used,
    i.is_cancelled,
    i.created_at,
    i.expires_at,
    i.invited_by,
    i.accepted_at,
    i.accepted_by
  FROM invites i
  WHERE i.store_id = p_store_id
  ORDER BY i.created_at DESC;
END;
$$;

-- 함수에 대한 RLS 정책 (모든 사용자가 접근 가능하도록)
GRANT EXECUTE ON FUNCTION get_invites_by_store(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_invites_by_store(UUID) TO anon;
