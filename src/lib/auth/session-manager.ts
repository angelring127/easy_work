import { createClient } from '@/lib/supabase/client';
import { User, Session } from '@supabase/supabase-js';

export interface SessionState {
  user: User | null;
  session: Session | null;
  isExpired: boolean;
  expiresAt: number | null;
}

export class SessionManager {
  private static instance: SessionManager;
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 60000; // 1분마다 체크
  private readonly REFRESH_THRESHOLD = 300000; // 5분 전에 갱신

  private constructor() {}

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  // 세션 상태 확인
  async getSessionState(): Promise<SessionState> {
    const supabase = createClient();
    
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session) {
        return {
          user: null,
          session: null,
          isExpired: true,
          expiresAt: null
        };
      }

      const expiresAt = session.expires_at ? session.expires_at * 1000 : null;
      const now = Date.now();
      const isExpired = expiresAt ? now >= expiresAt : false;

      return {
        user: session.user,
        session,
        isExpired,
        expiresAt
      };
    } catch (error) {
      console.error('세션 상태 확인 오류:', error);
      return {
        user: null,
        session: null,
        isExpired: true,
        expiresAt: null
      };
    }
  }

  // 세션 갱신 필요 여부 확인
  async shouldRefreshSession(): Promise<boolean> {
    const { session, isExpired, expiresAt } = await this.getSessionState();
    
    if (!session || isExpired) {
      return false; // 세션이 없거나 이미 만료됨
    }

    if (!expiresAt) {
      return false; // 만료 시간 정보 없음
    }

    const now = Date.now();
    const timeUntilExpiry = expiresAt - now;
    
    // 만료 5분 전이면 갱신 필요
    return timeUntilExpiry <= this.REFRESH_THRESHOLD;
  }

  // 자동 세션 갱신
  async refreshSession(): Promise<boolean> {
    const supabase = createClient();
    
    try {
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error || !data.session) {
        console.error('세션 갱신 실패:', error);
        return false;
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('세션 갱신 성공:', data.session.user?.email);
      }
      
      return true;
    } catch (error) {
      console.error('세션 갱신 중 오류:', error);
      return false;
    }
  }

  // 주기적 세션 체크 시작
  startPeriodicCheck(onExpired?: () => void, onRefreshed?: () => void): void {
    if (this.checkInterval) {
      return; // 이미 실행 중
    }

    this.checkInterval = setInterval(async () => {
      try {
        const { isExpired } = await this.getSessionState();
        
        if (isExpired) {
          if (process.env.NODE_ENV === 'development') {
            console.log('세션 만료 감지');
          }
          onExpired?.();
          this.stopPeriodicCheck();
          return;
        }

        // 갱신 필요 시 자동 갱신
        if (await this.shouldRefreshSession()) {
          const refreshed = await this.refreshSession();
          if (refreshed) {
            onRefreshed?.();
          } else {
            if (process.env.NODE_ENV === 'development') {
              console.log('세션 갱신 실패 - 만료 처리');
            }
            onExpired?.();
            this.stopPeriodicCheck();
          }
        }
      } catch (error) {
        console.error('주기적 세션 체크 오류:', error);
      }
    }, this.CHECK_INTERVAL);

    if (process.env.NODE_ENV === 'development') {
      console.log('주기적 세션 체크 시작');
    }
  }

  // 주기적 세션 체크 중지
  stopPeriodicCheck(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      
      if (process.env.NODE_ENV === 'development') {
        console.log('주기적 세션 체크 중지');
      }
    }
  }

  // 즉시 로그아웃
  async forceLogout(): Promise<void> {
    const supabase = createClient();
    
    try {
      await supabase.auth.signOut();
      this.stopPeriodicCheck();
      
      // 페이지 리다이렉트
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    } catch (error) {
      console.error('강제 로그아웃 오류:', error);
    }
  }

  // 클린업
  cleanup(): void {
    this.stopPeriodicCheck();
  }
}

export const sessionManager = SessionManager.getInstance();
