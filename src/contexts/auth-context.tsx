"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { User, Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { sessionManager } from "@/lib/auth/session-manager";
import {
  clearLocalSupabaseSession,
  isInvalidRefreshTokenError,
} from "@/lib/auth/session-error";
import { UserRole, type UserProfile } from "@/types/auth";
import {
  canReadAdminConsole,
  extractPlatformAdminRole,
} from "@/lib/auth/platform-admin";
import { defaultLocale } from "@/lib/i18n-config";

interface AuthContextType {
  user: UserProfile | null;
  rawUser: User | null; // 원본 Supabase User 객체
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  sessionExpired: boolean;
  isSessionValid: boolean;
  isProcessingInvite: boolean; // 초대 토큰 처리 중 상태
  setProcessingInvite: (processing: boolean) => void; // 초대 토큰 처리 상태 설정
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getLocaleFromPathname(pathname: string): string {
  return pathname.split("/")[1] || defaultLocale;
}

function getLoginRedirectPath(pathname: string): string {
  const currentLocale = getLocaleFromPathname(pathname);
  if (pathname.includes("/admin")) {
    return `/${currentLocale}/admin/login`;
  }

  return `/${currentLocale}/login`;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [rawUser, setRawUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [isSessionValid, setIsSessionValid] = useState(false);
  const [isProcessingInvite, setIsProcessingInvite] = useState(false);

  const [supabase] = useState(() => createClient());

  const resetAuthState = useCallback(() => {
    setUser(null);
    setRawUser(null);
    setSession(null);
    setSessionExpired(false);
    setIsSessionValid(false);
  }, []);

  const clearInvalidSession = useCallback(async () => {
    sessionManager.stopPeriodicCheck();
    await clearLocalSupabaseSession(supabase);
    resetAuthState();
  }, [resetAuthState, supabase]);

  // Supabase User를 UserProfile로 변환하는 헬퍼 함수
  const createUserProfile = useCallback(
    (supabaseUser: User | null): UserProfile | null => {
      if (!supabaseUser) return null;

      // 메타데이터에서 역할 정보 가져오기 (기본값: PART_TIMER)
      const role =
        (supabaseUser.user_metadata?.role as UserRole) || UserRole.PART_TIMER;

      return {
        id: supabaseUser.id,
        email: supabaseUser.email || "",
        name:
          supabaseUser.user_metadata?.name ||
          supabaseUser.email?.split("@")[0] ||
          "",
        role,
        platform_admin_role: extractPlatformAdminRole(
          (supabaseUser.user_metadata || {}) as Record<string, unknown>
        ),
        created_at: supabaseUser.created_at,
        updated_at: supabaseUser.updated_at || supabaseUser.created_at,
      };
    },
    []
  );

  // 세션 새로고침
  const refreshSession = useCallback(async () => {
    try {
      if (process.env.NODE_ENV === "development") {
        console.log("AuthContext: 수동 세션 새로고침 시작");
      }
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        if (isInvalidRefreshTokenError(error)) {
          await clearInvalidSession();
          return;
        }

        console.error("세션 새로고침 오류:", error);
        resetAuthState();
      } else {
        if (process.env.NODE_ENV === "development") {
          console.log(
            "AuthContext: 세션 새로고침 완료",
            data.session?.user?.email || "없음"
          );
        }
        const rawUserData = data.session?.user ?? null;
        setRawUser(rawUserData);
        setUser(createUserProfile(rawUserData));
        setSession(data.session);
      }
    } catch (error) {
      if (isInvalidRefreshTokenError(error)) {
        await clearInvalidSession();
        return;
      }

      console.error("세션 새로고침 중 예외 발생:", error);
      resetAuthState();
    }
  }, [clearInvalidSession, createUserProfile, resetAuthState, supabase]);

  // 로그아웃
  const signOut = async () => {
    try {
      // SessionManager 클린업
      sessionManager.stopPeriodicCheck();

      // API 호출로 로그아웃
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("로그아웃 API 호출 실패");
      }

      // 상태 초기화
      resetAuthState();

      // 로그아웃 후 로그인 페이지로 리다이렉트
      window.location.href = getLoginRedirectPath(window.location.pathname);
    } catch (error) {
      console.error("로그아웃 중 예외 발생:", error);

      // 오류 발생 시에도 클라이언트 측 로그아웃 실행
      try {
        await clearLocalSupabaseSession(supabase);
        resetAuthState();
        window.location.href = getLoginRedirectPath(window.location.pathname);
      } catch (fallbackError) {
        console.error("fallback 로그아웃 오류:", fallbackError);
      }
    }
  };

  useEffect(() => {
    // 초기 세션 가져오기
    const getInitialSession = async () => {
      try {
        if (process.env.NODE_ENV === "development") {
          console.log("AuthContext: 초기 세션 로딩 시작");
        }
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          if (isInvalidRefreshTokenError(error)) {
            await clearInvalidSession();
            return;
          }

          console.error("초기 세션 가져오기 오류:", error);
          resetAuthState();
        } else {
          if (process.env.NODE_ENV === "development") {
            console.log(
              "AuthContext: 초기 세션 데이터:",
              data.session?.user?.email || "없음"
            );
          }
          const rawUserData = data.session?.user ?? null;
          setRawUser(rawUserData);
          setUser(createUserProfile(rawUserData));
          setSession(data.session);
        }
      } catch (error) {
        if (isInvalidRefreshTokenError(error)) {
          await clearInvalidSession();
          return;
        }

        console.error("초기 세션 가져오기 중 예외 발생:", error);
        resetAuthState();
      } finally {
        setLoading(false);
        if (process.env.NODE_ENV === "development") {
          console.log("AuthContext: 초기 로딩 완료");
        }
      }
    };

    // 세션 유효성 체크 함수
    const checkSessionValidity = async () => {
      const sessionState = await sessionManager.getSessionState();
      setIsSessionValid(!sessionState.isExpired && !!sessionState.session);
      setSessionExpired(sessionState.isExpired);

      if (sessionState.isExpired && sessionState.session) {
        if (process.env.NODE_ENV === "development") {
          console.log("AuthContext: 세션 만료 감지");
        }
        resetAuthState();
      }
    };

    getInitialSession();

    // 초기 세션 유효성 체크
    checkSessionValidity();

    // SessionManager 주기적 체크 시작
    sessionManager.startPeriodicCheck(
      // 세션 만료 시 콜백
      () => {
        resetAuthState();
        setSessionExpired(true);

        // 로그인 페이지로 리다이렉트 (다국어 지원)
        window.location.href = getLoginRedirectPath(window.location.pathname);
      },
      // 세션 갱신 시 콜백
      () => {
        if (process.env.NODE_ENV === "development") {
          console.log("AuthContext: 세션 자동 갱신됨");
        }
        checkSessionValidity();
      }
    );

    // 인증 상태 변경 리스너 설정
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("AuthContext: 인증 상태 변경", {
        event,
        email: session?.user?.email || "없음",
        currentPath: window.location.pathname,
        timestamp: new Date().toISOString(),
      });

      const rawUserData = session?.user ?? null;
      const nextUserProfile = createUserProfile(rawUserData);
      setRawUser(rawUserData);
      setUser(nextUserProfile);
      setSession(session);
      // onAuthStateChange에서는 로딩 상태를 변경하지 않음
      // 초기 로딩만 getInitialSession에서 관리

      // 로그인 성공 시 적절한 페이지로 리다이렉트
      if (event === "SIGNED_IN" && session) {
        const currentPath = window.location.pathname;

        // 다국어 경로에서 현재 locale 추출
        const currentLocale = getLocaleFromPathname(currentPath);

        // 콜백 페이지에서 온 경우 대시보드로 리다이렉트
        if (currentPath.includes("/auth/callback")) {
          if (process.env.NODE_ENV === "development") {
            console.log("AuthContext: 콜백에서 대시보드로 리다이렉트");
          }
          window.location.href = `/${currentLocale}/dashboard`;
        }
        // 관리자 로그인 페이지에서 온 경우 권한에 따라 분기
        else if (currentPath.includes("/admin/login")) {
          if (canReadAdminConsole(nextUserProfile?.platform_admin_role)) {
            window.location.href = `/${currentLocale}/admin`;
          }
        }
        // 로그인/회원가입 페이지에서 온 경우에도 대시보드로 리다이렉트
        else if (
          currentPath.includes("/login") ||
          currentPath.includes("/signup")
        ) {
          // 초대 토큰 처리 중이면 리다이렉트 차단
          if (isProcessingInvite) {
            if (process.env.NODE_ENV === "development") {
              console.log("AuthContext: 초대 토큰 처리 중, 리다이렉트 차단");
            }
            return;
          }

          if (process.env.NODE_ENV === "development") {
            console.log(
              "AuthContext: 로그인/회원가입에서 대시보드로 리다이렉트"
            );
          }
          window.location.href = `/${currentLocale}/dashboard`;
        }
        // 대시보드에 이미 있는 경우 상태만 업데이트 (새로고침 제거)
        else if (currentPath.includes("/dashboard")) {
          if (process.env.NODE_ENV === "development") {
            console.log("AuthContext: 대시보드에서 상태 업데이트 완료");
          }
          // 새로고침 없이 상태만 업데이트
        }
        // 기타 페이지에서는 새로고침하지 않고 상태만 업데이트
      }
    });

    return () => {
      subscription.unsubscribe();
      sessionManager.cleanup();
    };
  }, [clearInvalidSession, createUserProfile, isProcessingInvite, resetAuthState, supabase]);

  const value = {
    user,
    rawUser,
    session,
    loading,
    signOut,
    refreshSession,
    sessionExpired,
    isSessionValid,
    isProcessingInvite,
    setProcessingInvite: setIsProcessingInvite,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// AuthContext 사용을 위한 커스텀 훅
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
