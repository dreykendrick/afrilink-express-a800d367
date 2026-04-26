export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      affiliate_clicks: {
        Row: {
          affiliate_id: string
          created_at: string
          id: string
          product_id: string
          session_id: string
        }
        Insert: {
          affiliate_id: string
          created_at?: string
          id?: string
          product_id: string
          session_id: string
        }
        Update: {
          affiliate_id?: string
          created_at?: string
          id?: string
          product_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_clicks_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_clicks_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliates: {
        Row: {
          code: string
          commission_rate: number
          created_at: string
          id: string
          is_active: boolean
          name: string
          phone: string | null
        }
        Insert: {
          code: string
          commission_rate?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
        }
        Update: {
          code?: string
          commission_rate?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
        }
        Relationships: []
      }
      cities: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      cross_city_fees: {
        Row: {
          created_at: string
          fee: number
          from_city_id: string
          id: string
          to_city_id: string
        }
        Insert: {
          created_at?: string
          fee?: number
          from_city_id: string
          id?: string
          to_city_id: string
        }
        Update: {
          created_at?: string
          fee?: number
          from_city_id?: string
          id?: string
          to_city_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cross_city_fees_from_city_id_fkey"
            columns: ["from_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cross_city_fees_to_city_id_fkey"
            columns: ["to_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_settings: {
        Row: {
          base_fee: number
          created_at: string
          enabled: boolean
          free_delivery_threshold: number | null
          id: string
          max_delivery_distance_km: number | null
          maximum_fee: number | null
          minimum_fee: number
          price_per_km: number
          updated_at: string
        }
        Insert: {
          base_fee?: number
          created_at?: string
          enabled?: boolean
          free_delivery_threshold?: number | null
          id?: string
          max_delivery_distance_km?: number | null
          maximum_fee?: number | null
          minimum_fee?: number
          price_per_km?: number
          updated_at?: string
        }
        Update: {
          base_fee?: number
          created_at?: string
          enabled?: boolean
          free_delivery_threshold?: number | null
          id?: string
          max_delivery_distance_km?: number | null
          maximum_fee?: number | null
          minimum_fee?: number
          price_per_km?: number
          updated_at?: string
        }
        Relationships: []
      }
      order_issues: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          order_id: string
          reason: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          order_id: string
          reason: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          order_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_issues_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_ledger: {
        Row: {
          amount: number
          created_at: string
          currency: string
          entry_type: string
          id: string
          notes: string | null
          order_id: string
          paid_at: string | null
          payout_id: string | null
          recipient_id: string | null
          recipient_type: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          entry_type: string
          id?: string
          notes?: string | null
          order_id: string
          paid_at?: string | null
          payout_id?: string | null
          recipient_id?: string | null
          recipient_type?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          entry_type?: string
          id?: string
          notes?: string | null
          order_id?: string
          paid_at?: string | null
          payout_id?: string | null
          recipient_id?: string | null
          recipient_type?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_ledger_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_ledger_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "payouts"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          affiliate_id: string | null
          affiliate_rate_at_purchase: number | null
          buyer_area: string
          buyer_city_id: string | null
          buyer_confirmed_at: string | null
          buyer_landmark: string | null
          buyer_name: string
          buyer_notes: string | null
          buyer_phone: string
          buyer_role: string | null
          buyer_user_id: string | null
          confirmation_token: string
          confirmed_at: string | null
          created_at: string
          delivery_address: string | null
          delivery_fee: number
          delivery_lat: number | null
          delivery_lng: number | null
          delivery_settings_snapshot: Json | null
          distance_km: number | null
          external_forwarded_at: string | null
          external_order_id: string | null
          id: string
          item_price: number
          notification_status: string | null
          order_number: string
          order_status: string
          payment_status: string
          product_id: string
          source: string | null
          total_amount: number
          tracking_token: string | null
          tracking_url: string | null
          updated_at: string
          vendor_confirmed_at: string | null
          vendor_notified_at: string | null
        }
        Insert: {
          affiliate_id?: string | null
          affiliate_rate_at_purchase?: number | null
          buyer_area: string
          buyer_city_id?: string | null
          buyer_confirmed_at?: string | null
          buyer_landmark?: string | null
          buyer_name: string
          buyer_notes?: string | null
          buyer_phone: string
          buyer_role?: string | null
          buyer_user_id?: string | null
          confirmation_token?: string
          confirmed_at?: string | null
          created_at?: string
          delivery_address?: string | null
          delivery_fee?: number
          delivery_lat?: number | null
          delivery_lng?: number | null
          delivery_settings_snapshot?: Json | null
          distance_km?: number | null
          external_forwarded_at?: string | null
          external_order_id?: string | null
          id?: string
          item_price: number
          notification_status?: string | null
          order_number: string
          order_status?: string
          payment_status?: string
          product_id: string
          source?: string | null
          total_amount: number
          tracking_token?: string | null
          tracking_url?: string | null
          updated_at?: string
          vendor_confirmed_at?: string | null
          vendor_notified_at?: string | null
        }
        Update: {
          affiliate_id?: string | null
          affiliate_rate_at_purchase?: number | null
          buyer_area?: string
          buyer_city_id?: string | null
          buyer_confirmed_at?: string | null
          buyer_landmark?: string | null
          buyer_name?: string
          buyer_notes?: string | null
          buyer_phone?: string
          buyer_role?: string | null
          buyer_user_id?: string | null
          confirmation_token?: string
          confirmed_at?: string | null
          created_at?: string
          delivery_address?: string | null
          delivery_fee?: number
          delivery_lat?: number | null
          delivery_lng?: number | null
          delivery_settings_snapshot?: Json | null
          distance_km?: number | null
          external_forwarded_at?: string | null
          external_order_id?: string | null
          id?: string
          item_price?: number
          notification_status?: string | null
          order_number?: string
          order_status?: string
          payment_status?: string
          product_id?: string
          source?: string | null
          total_amount?: number
          tracking_token?: string | null
          tracking_url?: string | null
          updated_at?: string
          vendor_confirmed_at?: string | null
          vendor_notified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_buyer_city_id_fkey"
            columns: ["buyer_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_accounts: {
        Row: {
          account_name: string | null
          account_number: string
          account_type: string
          created_at: string
          id: string
          is_default: boolean
          owner_id: string
          owner_type: string
          provider: string | null
          updated_at: string
        }
        Insert: {
          account_name?: string | null
          account_number: string
          account_type?: string
          created_at?: string
          id?: string
          is_default?: boolean
          owner_id: string
          owner_type: string
          provider?: string | null
          updated_at?: string
        }
        Update: {
          account_name?: string | null
          account_number?: string
          account_type?: string
          created_at?: string
          id?: string
          is_default?: boolean
          owner_id?: string
          owner_type?: string
          provider?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payout_settings: {
        Row: {
          enabled: boolean
          frequency: string
          hold_days: number
          id: string
          min_threshold: number
          run_hour: number
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          frequency?: string
          hold_days?: number
          id?: string
          min_threshold?: number
          run_hour?: number
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          frequency?: string
          hold_days?: number
          id?: string
          min_threshold?: number
          run_hour?: number
          updated_at?: string
        }
        Relationships: []
      }
      payouts: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          idempotency_key: string | null
          notes: string | null
          payout_account_id: string | null
          provider_reference: string | null
          recipient_id: string
          recipient_type: string
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          idempotency_key?: string | null
          notes?: string | null
          payout_account_id?: string | null
          provider_reference?: string | null
          recipient_id: string
          recipient_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          idempotency_key?: string | null
          notes?: string | null
          payout_account_id?: string | null
          provider_reference?: string | null
          recipient_id?: string
          recipient_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_payout_account_id_fkey"
            columns: ["payout_account_id"]
            isOneToOne: false
            referencedRelation: "payout_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          description: string | null
          id: string
          images: string[] | null
          is_active: boolean
          name: string
          price: number
          short_description: string | null
          slug: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          images?: string[] | null
          is_active?: boolean
          name: string
          price: number
          short_description?: string | null
          slug: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          images?: string[] | null
          is_active?: boolean
          name?: string
          price?: number
          short_description?: string | null
          slug?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      same_city_zones: {
        Row: {
          city_id: string
          created_at: string
          fee: number
          id: string
          zone_name: string
        }
        Insert: {
          city_id: string
          created_at?: string
          fee?: number
          id?: string
          zone_name: string
        }
        Update: {
          city_id?: string
          created_at?: string
          fee?: number
          id?: string
          zone_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "same_city_zones_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          address: string | null
          city_id: string | null
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          name: string
          phone: string
        }
        Insert: {
          address?: string | null
          city_id?: string | null
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          phone: string
        }
        Update: {
          address?: string | null
          city_id?: string | null
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendors_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          order_id: string | null
          type: string
          wallet_id: string
          withdrawal_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          order_id?: string | null
          type: string
          wallet_id: string
          withdrawal_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          order_id?: string | null
          type?: string
          wallet_id?: string
          withdrawal_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_withdrawal_id_fkey"
            columns: ["withdrawal_id"]
            isOneToOne: false
            referencedRelation: "withdrawals"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          currency: string
          id: string
          owner_id: string
          owner_type: string
          total_earned: number
          total_withdrawn: number
          updated_at: string
        }
        Insert: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          owner_id: string
          owner_type: string
          total_earned?: number
          total_withdrawn?: number
          updated_at?: string
        }
        Update: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          owner_id?: string
          owner_type?: string
          total_earned?: number
          total_withdrawn?: number
          updated_at?: string
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          amount: number
          created_at: string
          failure_reason: string | null
          fee: number
          id: string
          method: string
          net_amount: number
          owner_id: string
          owner_type: string
          phone_number: string
          processed_at: string | null
          provider_reference: string | null
          status: string
          updated_at: string
          wallet_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          failure_reason?: string | null
          fee?: number
          id?: string
          method?: string
          net_amount: number
          owner_id: string
          owner_type: string
          phone_number: string
          processed_at?: string | null
          provider_reference?: string | null
          status?: string
          updated_at?: string
          wallet_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          failure_reason?: string | null
          fee?: number
          id?: string
          method?: string
          net_amount?: number
          owner_id?: string
          owner_type?: string
          phone_number?: string
          processed_at?: string | null
          provider_reference?: string | null
          status?: string
          updated_at?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawals_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      credit_wallets_for_order: { Args: { p_order_id: string }; Returns: Json }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
