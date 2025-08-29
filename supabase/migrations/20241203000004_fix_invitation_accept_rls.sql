-- =============================================
-- Fix invitation accept RLS issue
-- =============================================

-- 초대 수락 시 상태 업데이트를 위한 RPC 함수 (RLS 우회)
CREATE OR REPLACE FUNCTION accept_invitation(
    p_invitation_id UUID,
    p_accepted_by UUID,
    p_token_hash TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    invitation_record RECORD;
    success BOOLEAN := FALSE;
BEGIN
    -- 초대 정보 조회
    SELECT * INTO invitation_record
    FROM invitations
    WHERE id = p_invitation_id AND token_hash = p_token_hash;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invitation not found or invalid token';
    END IF;
    
    -- 초대 상태 업데이트 (RLS 우회)
    UPDATE invitations 
    SET 
        status = 'ACCEPTED',
        accepted_at = NOW(),
        accepted_by = p_accepted_by,
        updated_at = NOW()
    WHERE id = p_invitation_id AND token_hash = p_token_hash;
    
    -- 업데이트 성공 확인
    IF FOUND THEN
        success := TRUE;
        
        -- 감사 로그 기록
        INSERT INTO store_audit_logs (
            store_id, user_id, action, table_name, old_values, new_values
        ) VALUES (
            invitation_record.store_id,
            p_accepted_by,
            'ACCEPT_INVITATION',
            'invitations',
            jsonb_build_object(
                'id', invitation_record.id,
                'status', invitation_record.status,
                'token_hash', invitation_record.token_hash
            ),
            jsonb_build_object(
                'id', invitation_record.id,
                'status', 'ACCEPTED',
                'accepted_by', p_accepted_by,
                'accepted_at', NOW()
            )
        );
    END IF;
    
    RETURN success;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 함수 실행 권한 부여
GRANT EXECUTE ON FUNCTION accept_invitation(UUID, UUID, TEXT) TO authenticated;
