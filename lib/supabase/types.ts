/**
 * Database types for the Phase 1 schema.
 * Hand-written to match supabase/migrations. Regenerate once the project is
 * linked with: npm run db:types
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type MemberRole = "flatmate" | "cook" | "maid";

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
      is_flat_member: { Args: { p_flat_id: string }; Returns: boolean };
      is_flat_admin: { Args: { p_flat_id: string }; Returns: boolean };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Flat = Database["public"]["Tables"]["flats"]["Row"];
export type Member = Database["public"]["Tables"]["members"]["Row"];
