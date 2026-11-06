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
export type AwaySlot = "morning" | "afternoon" | "night";

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
  breakfast: string | null;
  lunch: string | null;
  dinner: string | null;
  plan: MenuPlan;
  created_at: string;
};
export type SplitRule = "all_members" | "present_only" | "per_day_worked" | "custom";
type ExpenseCategoryRow = { id: string; flat_id: string; name: string; default_rule: SplitRule; created_at: string };
type ExpenseRow = {
  id: string;
  flat_id: string;
  category_id: string;
  title: string;
  merchant: string | null;
  paid_by: string;
  total_paise: number;
  expense_date: string;
  source: "manual" | "scan";
  bill_image_path: string | null;
  rule_note: string | null;
  created_by: string;
  settled: boolean;
  created_at: string;
};
type ExpenseItemRow = {
  id: string;
  expense_id: string;
  flat_id: string;
  name: string;
  quantity: number | null;
  amount_paise: number;
  kind: "item" | "fee" | "tax" | "discount";
  included: boolean;
  personal_member_id: string | null;
  sort_order: number;
  created_at: string;
};
type ExpenseShareRow = {
  expense_id: string;
  member_id: string;
  flat_id: string;
  amount_paise: number;
  is_custom: boolean;
  reason: string | null;
  created_at: string;
};
type AppUserRow = {
  id: string;
  username: string;
  display_name: string;
  password_hash: string;
  failed_attempts: number;
  locked_until: string | null;
  created_at: string;
};
export type JoinRequestStatus = "pending" | "accepted" | "declined" | "cancelled";
type JoinRequestRow = {
  id: string;
  flat_id: string;
  user_id: string;
  name: string;
  status: JoinRequestStatus;
  decided_by: string | null;
  decided_at: string | null;
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
          flat_code: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          timezone?: string;
          menu_owner_id?: string | null;
          prorate_monthly?: boolean;
          invite_code?: string;
          flat_code?: string;
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
          slots: AwaySlot[] | null;
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
          slots?: AwaySlot[] | null;
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
      expense_categories: Table<ExpenseCategoryRow, "flat_id" | "name" | "default_rule">;
      expenses: Table<ExpenseRow, "flat_id" | "category_id" | "title" | "paid_by" | "total_paise" | "expense_date" | "created_by">;
      expense_items: Table<ExpenseItemRow, "expense_id" | "flat_id" | "name" | "amount_paise" | "kind">;
      expense_shares: Table<ExpenseShareRow, "expense_id" | "member_id" | "flat_id" | "amount_paise">;
      app_users: Table<AppUserRow, "username" | "display_name" | "password_hash">;
      push_subscriptions: Table<PushSubscriptionRow, "flat_id" | "member_id" | "endpoint" | "p256dh" | "auth">;
      join_requests: Omit<Table<JoinRequestRow, "flat_id" | "user_id" | "name">, "Relationships"> & {
        Relationships: [
          {
            foreignKeyName: "join_requests_flat_id_fkey";
            columns: ["flat_id"];
            isOneToOne: false;
            referencedRelation: "flats";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "join_requests_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "app_users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      create_flat: { Args: { p_user_id: string; p_flat_name: string; p_member_name: string }; Returns: string };
      request_to_join: { Args: { p_user_id: string; p_code: string; p_name: string }; Returns: string };
      decide_join_request: { Args: { p_user_id: string; p_request_id: string; p_accept: boolean }; Returns: undefined };
      remove_member: { Args: { p_user_id: string; p_member_id: string }; Returns: "left" | "deleted" };
      set_chore_done: { Args: { p_user_id: string; p_assignment_id: string; p_done: boolean }; Returns: undefined };
      save_expense: { Args: { p_user_id: string; p: Json }; Returns: string };
      set_expense_settled: { Args: { p_user_id: string; p_expense_id: string }; Returns: undefined };
      delete_expense: { Args: { p_user_id: string; p_expense_id: string }; Returns: undefined };
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
export type ExpenseCategory = ExpenseCategoryRow;
export type Expense = ExpenseRow;
export type ExpenseItemDb = ExpenseItemRow;
export type ExpenseShare = ExpenseShareRow;
export type AppUser = AppUserRow;
export type JoinRequest = JoinRequestRow;
