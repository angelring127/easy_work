// Supabase 관련 타입 정의
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      stores: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          address: string | null;
          phone: string | null;
          timezone: string;
          status: string;
          owner_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          address?: string | null;
          phone?: string | null;
          timezone?: string;
          status?: string;
          owner_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          address?: string | null;
          phone?: string | null;
          timezone?: string;
          status?: string;
          owner_id?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      store_settings: {
        Row: {
          id: string;
          store_id: string;
          business_hours: Json;
          shift_policy: Json;
          chat_policy: Json;
          contact_info: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          business_hours?: Json;
          shift_policy?: Json;
          chat_policy?: Json;
          contact_info?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          business_hours?: Json;
          shift_policy?: Json;
          chat_policy?: Json;
          contact_info?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      store_audit_logs: {
        Row: {
          id: string;
          store_id: string;
          user_id: string;
          action: string;
          table_name: string;
          old_values: Json | null;
          new_values: Json | null;
          ip_address: unknown | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          user_id: string;
          action: string;
          table_name: string;
          old_values?: Json | null;
          new_values?: Json | null;
          ip_address?: unknown | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          user_id?: string;
          action?: string;
          table_name?: string;
          old_values?: Json | null;
          new_values?: Json | null;
          ip_address?: unknown | null;
          user_agent?: string | null;
          created_at?: string;
        };
      };
      user_store_roles: {
        Row: {
          id: string;
          user_id: string;
          store_id: string;
          role: string;
          status: string;
          is_default_store: boolean;
          temporary_start_date: string | null;
          temporary_end_date: string | null;
          granted_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          store_id: string;
          role: string;
          status?: string;
          is_default_store?: boolean;
          temporary_start_date?: string | null;
          temporary_end_date?: string | null;
          granted_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          store_id?: string;
          role?: string;
          status?: string;
          is_default_store?: boolean;
          temporary_start_date?: string | null;
          temporary_end_date?: string | null;
          granted_at?: string;
          updated_at?: string;
        };
      };
      temporary_assignments: {
        Row: {
          id: string;
          user_id: string;
          store_id: string;
          assigned_by: string;
          start_date: string;
          end_date: string;
          reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          store_id: string;
          assigned_by: string;
          start_date: string;
          end_date: string;
          reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          store_id?: string;
          assigned_by?: string;
          start_date?: string;
          end_date?: string;
          reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      invitations: {
        Row: {
          id: string;
          store_id: string;
          invited_email: string;
          role_hint: string;
          token_hash: string;
          expires_at: string;
          status: string;
          invited_by: string;
          accepted_at: string | null;
          accepted_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          invited_email: string;
          role_hint?: string;
          token_hash: string;
          expires_at: string;
          status?: string;
          invited_by: string;
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          invited_email?: string;
          role_hint?: string;
          token_hash?: string;
          expires_at?: string;
          status?: string;
          invited_by?: string;
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      store_job_roles: {
        Row: {
          id: string;
          store_id: string;
          name: string;
          code: string | null;
          description: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          name: string;
          code?: string | null;
          description?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          name?: string;
          code?: string | null;
          description?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_store_job_roles: {
        Row: {
          store_id: string;
          user_id: string;
          job_role_id: string;
          created_at: string;
        };
        Insert: {
          store_id: string;
          user_id: string;
          job_role_id: string;
          created_at?: string;
        };
        Update: {
          store_id?: string;
          user_id?: string;
          job_role_id?: string;
          created_at?: string;
        };
      };
      work_item_required_roles: {
        Row: {
          work_item_id: string;
          job_role_id: string;
          min_count: number;
        };
        Insert: {
          work_item_id: string;
          job_role_id: string;
          min_count?: number;
        };
        Update: {
          work_item_id?: string;
          job_role_id?: string;
          min_count?: number;
        };
      };
      work_items: {
        Row: {
          id: string;
          store_id: string;
          name: string;
          start_min: number;
          end_min: number;
          unpaid_break_min: number;
          max_headcount: number;
          role_hint: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          name: string;
          start_min: number;
          end_min: number;
          unpaid_break_min?: number;
          max_headcount?: number;
          role_hint?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          name?: string;
          start_min?: number;
          end_min?: number;
          unpaid_break_min?: number;
          max_headcount?: number;
          role_hint?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      user_accessible_stores: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          address: string | null;
          phone: string | null;
          timezone: string;
          status: string;
          owner_id: string;
          created_at: string;
          updated_at: string;
          user_role: string;
          granted_at: string;
          business_hours: Json | null;
          shift_policy: Json | null;
          chat_policy: Json | null;
          contact_info: Json | null;
        };
      };
      store_members: {
        Row: {
          id: string;
          user_id: string;
          store_id: string;
          role: string;
          status: string;
          is_default_store: boolean;
          granted_at: string;
          updated_at: string;
          email: string;
          name: string | null;
          avatar_url: string | null;
          user_created_at: string;
          last_sign_in_at: string | null;
          temp_start_date: string | null;
          temp_end_date: string | null;
          temp_reason: string | null;
        };
      };
      invitation_details: {
        Row: {
          id: string;
          store_id: string;
          invited_email: string;
          role_hint: string;
          token_hash: string;
          expires_at: string;
          status: string;
          invited_by: string;
          accepted_at: string | null;
          accepted_by: string | null;
          created_at: string;
          updated_at: string;
          store_name: string;
          inviter_email: string;
          inviter_name: string | null;
          accepter_email: string | null;
          accepter_name: string | null;
        };
      };
    };
    Functions: {
      create_default_store_settings: {
        Args: { store_uuid: string };
        Returns: string;
      };
      log_store_audit: {
        Args: {
          p_store_id: string;
          p_action: string;
          p_table_name: string;
          p_old_values?: Json;
          p_new_values?: Json;
        };
        Returns: string;
      };
      grant_user_role: {
        Args: {
          p_user_id: string;
          p_store_id: string;
          p_role: string;
          p_granted_by?: string;
        };
        Returns: string;
      };
      revoke_user_role: {
        Args: {
          p_user_id: string;
          p_store_id: string;
          p_revoked_by?: string;
        };
        Returns: boolean;
      };
      assign_temporary_work: {
        Args: {
          p_user_id: string;
          p_store_id: string;
          p_start_date: string;
          p_end_date: string;
          p_reason?: string;
          p_assigned_by?: string;
        };
        Returns: string;
      };
      generate_invite_token: {
        Args: {};
        Returns: string;
      };
      create_invitation: {
        Args: {
          p_store_id: string;
          p_invited_email: string;
          p_role_hint?: string;
          p_expires_in_days?: number;
          p_invited_by?: string;
        };
        Returns: string;
      };
      accept_invitation: {
        Args: {
          p_token_hash: string;
          p_accepted_by?: string;
        };
        Returns: string;
      };
      cleanup_expired_invitations: {
        Args: {};
        Returns: number;
      };
    };
    Enums: {
      [key: string]: never;
    };
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type Views<T extends keyof Database["public"]["Views"]> =
  Database["public"]["Views"][T]["Row"];

export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T];

// 매장 관련 타입 정의
export interface Store {
  id: string;
  name: string;
  description?: string;
  address?: string;
  phone?: string;
  timezone: string;
  status: "ACTIVE" | "ARCHIVED";
  owner_id: string;
  created_at: string;
  updated_at: string;
  user_role?: "MASTER" | "SUB_MANAGER" | "PART_TIMER";
  granted_at?: string;
  business_hours?: BusinessHours;
  shift_policy?: ShiftPolicy;
  chat_policy?: ChatPolicy;
  contact_info?: ContactInfo;
}

export interface BusinessHours {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

export interface DaySchedule {
  open: string; // "09:00"
  close: string; // "18:00"
  enabled: boolean;
}

export interface ShiftPolicy {
  min_shift_hours: number;
  max_shift_hours: number;
  break_time_minutes: number;
  overtime_threshold_hours: number;
}

export interface ChatPolicy {
  global_chat_enabled: boolean;
  store_chat_enabled: boolean;
  announcement_pin_limit: number;
  mention_notifications: boolean;
}

export interface ContactInfo {
  phone: string;
  email: string;
  address: string;
  website: string;
}

export interface StoreSettings {
  id: string;
  store_id: string;
  business_hours: BusinessHours;
  shift_policy: ShiftPolicy;
  chat_policy: ChatPolicy;
  contact_info: ContactInfo;
  created_at: string;
  updated_at: string;
}

export interface StoreAuditLog {
  id: string;
  store_id: string;
  user_id: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "ARCHIVE";
  table_name: "stores" | "store_settings";
  old_values?: any;
  new_values?: any;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

// 사용자 관리 관련 타입 정의
export interface StoreMember {
  id: string;
  user_id: string;
  store_id: string;
  role: "MASTER" | "SUB_MANAGER" | "PART_TIMER";
  status: "PENDING" | "ACTIVE" | "INACTIVE";
  is_default_store: boolean;
  granted_at: string;
  updated_at: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  user_created_at: string;
  last_sign_in_at: string | null;
  temp_start_date: string | null;
  temp_end_date: string | null;
  temp_reason: string | null;
}

export interface TemporaryAssignment {
  id: string;
  user_id: string;
  store_id: string;
  assigned_by: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRoleGrantRequest {
  userId: string;
  role: "SUB_MANAGER" | "PART_TIMER";
}

export interface TemporaryAssignmentRequest {
  userId: string;
  startDate: string;
  endDate: string;
  reason?: string;
}

export interface UserManagementFilters {
  role?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface Invitation {
  id: string;
  store_id: string;
  invited_email: string;
  role_hint: "PART_TIMER" | "SUB_MANAGER";
  token_hash: string;
  expires_at: string;
  status: "PENDING" | "ACCEPTED" | "EXPIRED" | "CANCELLED";
  invited_by: string;
  accepted_at: string | null;
  accepted_by: string | null;
  created_at: string;
  updated_at: string;
  store_name?: string;
  inviter_email?: string;
  inviter_name?: string | null;
  accepter_email?: string | null;
  accepter_name?: string | null;
}

export interface CreateInvitationRequest {
  storeId: string;
  email: string;
  roleHint?: "PART_TIMER" | "SUB_MANAGER";
  expiresInDays?: number;
}

export interface InvitationResponse {
  invitations: Invitation[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
