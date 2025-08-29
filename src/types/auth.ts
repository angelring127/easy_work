// 인증 및 역할 관련 타입 정의

/**
 * 사용자 역할 (User Roles)
 * MASTER: 마스터 관리자 - 복수 매장 소유·운영
 * SUB_MANAGER: 서브 관리자 - 특정 매장에 위임된 관리자
 * PART_TIMER: 알바생 - 기본 1개 매장 소속, 임시 근무 가능
 */
export enum UserRole {
  MASTER = "MASTER",
  SUB_MANAGER = "SUB_MANAGER",
  PART_TIMER = "PART_TIMER",
}

/**
 * 권한 레벨 (Permission Levels)
 */
export enum Permission {
  // 매장 관리 권한
  CREATE_STORE = "CREATE_STORE",
  MANAGE_STORE = "MANAGE_STORE",
  DELETE_STORE = "DELETE_STORE",

  // 사용자 관리 권한
  INVITE_USER = "INVITE_USER",
  MANAGE_USER_ROLES = "MANAGE_USER_ROLES",
  REMOVE_USER = "REMOVE_USER",

  // 스케줄 관리 권한
  CREATE_SCHEDULE = "CREATE_SCHEDULE",
  EDIT_SCHEDULE = "EDIT_SCHEDULE",
  DELETE_SCHEDULE = "DELETE_SCHEDULE",
  VIEW_SCHEDULE = "VIEW_SCHEDULE",

  // 교대 요청 권한
  CREATE_SHIFT_REQUEST = "CREATE_SHIFT_REQUEST",
  APPROVE_SHIFT_REQUEST = "APPROVE_SHIFT_REQUEST",
  VIEW_SHIFT_REQUESTS = "VIEW_SHIFT_REQUESTS",

  // 채팅 권한
  GLOBAL_CHAT = "GLOBAL_CHAT",
  STORE_CHAT = "STORE_CHAT",
  SEND_ANNOUNCEMENT = "SEND_ANNOUNCEMENT",

  // 대시보드 권한
  VIEW_ANALYTICS = "VIEW_ANALYTICS",
  VIEW_ADMIN_DASHBOARD = "VIEW_ADMIN_DASHBOARD",
}

/**
 * 역할별 권한 매핑
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.MASTER]: [
    // 모든 권한 보유
    Permission.CREATE_STORE,
    Permission.MANAGE_STORE,
    Permission.DELETE_STORE,
    Permission.INVITE_USER,
    Permission.MANAGE_USER_ROLES,
    Permission.REMOVE_USER,
    Permission.CREATE_SCHEDULE,
    Permission.EDIT_SCHEDULE,
    Permission.DELETE_SCHEDULE,
    Permission.VIEW_SCHEDULE,
    Permission.CREATE_SHIFT_REQUEST,
    Permission.APPROVE_SHIFT_REQUEST,
    Permission.VIEW_SHIFT_REQUESTS,
    Permission.GLOBAL_CHAT,
    Permission.STORE_CHAT,
    Permission.SEND_ANNOUNCEMENT,
    Permission.VIEW_ANALYTICS,
    Permission.VIEW_ADMIN_DASHBOARD,
  ],

  [UserRole.SUB_MANAGER]: [
    // 매장 관리 권한 (생성/삭제 제외)
    Permission.MANAGE_STORE,
    Permission.INVITE_USER,
    Permission.MANAGE_USER_ROLES,
    Permission.REMOVE_USER,
    Permission.CREATE_SCHEDULE,
    Permission.EDIT_SCHEDULE,
    Permission.DELETE_SCHEDULE,
    Permission.VIEW_SCHEDULE,
    Permission.APPROVE_SHIFT_REQUEST,
    Permission.VIEW_SHIFT_REQUESTS,
    Permission.GLOBAL_CHAT,
    Permission.STORE_CHAT,
    Permission.SEND_ANNOUNCEMENT,
    Permission.VIEW_ADMIN_DASHBOARD,
  ],

  [UserRole.PART_TIMER]: [
    // 기본 사용자 권한
    Permission.VIEW_SCHEDULE,
    Permission.CREATE_SHIFT_REQUEST,
    Permission.GLOBAL_CHAT,
    Permission.STORE_CHAT,
  ],
};

/**
 * 사용자 프로필 타입 (Supabase Auth 메타데이터)
 */
export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

/**
 * 매장 사용자 역할 (매장별 권한 관리)
 */
export interface StoreUserRole {
  id: string;
  store_id: string;
  user_id: string;
  role: UserRole;
  granted_by: string; // 권한을 부여한 사용자 ID
  granted_at: string;
  is_active: boolean;
}

/**
 * 권한 확인 결과
 */
export interface PermissionCheck {
  hasPermission: boolean;
  reason?: string;
  requiredRole?: UserRole;
}

/**
 * 역할 변경 요청
 */
export interface RoleChangeRequest {
  userId: string;
  newRole: UserRole;
  storeId?: string; // 매장별 역할인 경우
  reason?: string;
}
