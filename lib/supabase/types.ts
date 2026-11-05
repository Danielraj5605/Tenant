/**
 * Database types for the schema in supabase/migrations.
 * Hand-written to match supabase/migrations. Regenerate once the project is
 * linked with: npm run db:types
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type MemberRole = "flatmate" | "cook" | "maid";
export type ChoreFrequency = "daily" | "weekly" | "custom";
export type AssignmentStatus = "pending" | "done" | "skipped";
export type MenuPlan = "cook" | "order_in" | "self_cook";

/** Shorthand for tables queried without embedded joins. */
type Table<Row, Required extends keyof Row> = {
  Row: Row;
  Insert: Pick<Row, Required> & Partial<Omit<Row, Required>>;
  Update: Partial<Row>;
  Relationships: [];
};

type ChoreRow = {
  id: string;
  flat_id: string;
  name: string;
  frequency: ChoreFrequency;
  days_of_week: number[];
  due_time: string | null;
  created_at: string;
};
type ChoreRotationRow = { chore_id: string; member_id: string; flat_id: string; position: number; created_at: string };
type ChoreAssignmentRow = {
  id: string;
  chore_id: string;
  flat_id: string;
  member_id: string | null;
  due_date: string;
  status: AssignmentStatus;
  done_at: string | null;
  created_at: string;
};
type MenuDayRow = {
  id: string;
  flat_id: string;
  date: string;
  lunch: string | null;
  dinner: string | null;
  plan: MenuPlan;
  created_at: string;
};
type PushSubscriptionRow = {
  id: string;
  flat_id: string;
  member_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      flats: {
        Row: {
          id: string;
          name: string;
          timezone: string;
          menu_owner_id: string | null;
          prorate_monthly: boolean;
          invite_code: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          timezone?: string;
          menu_owner_id?: string | null;
          prorate_monthly?: boolean;
          invite_code?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["flats"]["Insert"]>;
        Relationships: [];
      };
      members: {
        Row: {
          id: string;
          flat_id: string;
          user_id: string | null;
          name: string;
          role: MemberRole;
          is_admin: boolean;
          joined_on: string;
          left_on: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          flat_id: string;
          user_id?: string | null;
          name: string;
          role: MemberRole;
          is_admin?: boolean;
          joined_on?: string;
          left_on?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["members"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "members_flat_id_fkey";
            columns: ["flat_id"];
            isOneToOne: false;
            referencedRelation: "flats";
            referencedColumns: ["id"];
          },
        ];
      };
      away_periods: {
        Row: {
          id: string;
          flat_id: string;
          member_id: string;
          start_date: string;
          end_date: string;
          full_day: boolean;
          reason: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          flat_id: string;
          member_id: string;
          start_date: string;
          end_date: string;
          full_day?: boolean;
          reason?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["away_periods"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "away_periods_member_fk";
            columns: ["member_id", "flat_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id", "flat_id"];
          },
        ];
      };
      chores: Table<ChoreRow, "flat_id" | "name" | "frequency">;
      chore_rotation: Table<ChoreRotationRow, "chore_id" | "member_id" | "flat_id" | "position">;
      chore_assignments: Table<ChoreAssignmentRow, "chore_id" | "flat_id" | "due_date">;
      menu_days: Table<MenuDayRow, "flat_id" | "date">;
      push_subscriptions: Table<PushSubscriptionRow, "flat_id" | "member_id" | "endpoint" | "p256dh" | "auth">;
    };
    Views: { [_ in never]: never };
    Functions: {
      create_flat: {
        Args: { p_flat_name: string; p_member_name: string };
        Returns: string;
      };
      join_flat: {
        Args: { p_code: string; p_member_name: string };
        Returns: string;
      };
      invite_preview: {
        Args: { p_code: string };
        Returns: {
          flat_id: string;
          flat_name: string;
          flatmate_count: number;
          already_member: boolean;
        }[];
      };
      set_chore_done: { Args: { p_assignment_id: string; p_done: boolean }; Returns: undefined };
      is_flat_member: { Args: { p_flat_id: string }; Returns: boolean };
      is_flat_admin: { Args: { p_flat_id: string }; Returns: boolean };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Flat = Database["public"]["Tables"]["flats"]["Row"];
export type Member = Database["public"]["Tables"]["members"]["Row"];
export type AwayPeriodRow = Database["public"]["Tables"]["away_periods"]["Row"];
export type Chore = ChoreRow;
export type ChoreAssignment = ChoreAssignmentRow;
export type MenuDay = MenuDayRow;
