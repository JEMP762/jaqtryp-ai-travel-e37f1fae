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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      booking_commissions: {
        Row: {
          created_at: string
          currency: string
          final_amount: number
          id: string
          markup_amount: number
          net_profit: number
          order_id: string | null
          order_kind: string
          original_amount: number
          payment_session_id: string | null
          provider: string
          service_fee_amount: number
          upsells: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          currency: string
          final_amount: number
          id?: string
          markup_amount?: number
          net_profit?: number
          order_id?: string | null
          order_kind: string
          original_amount: number
          payment_session_id?: string | null
          provider?: string
          service_fee_amount?: number
          upsells?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          final_amount?: number
          id?: string
          markup_amount?: number
          net_profit?: number
          order_id?: string | null
          order_kind?: string
          original_amount?: number
          payment_session_id?: string | null
          provider?: string
          service_fee_amount?: number
          upsells?: Json
          user_id?: string
        }
        Relationships: []
      }
      chat_conversations: {
        Row: {
          created_at: string
          id: string
          title: string
          trip_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          trip_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          trip_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_settings: {
        Row: {
          default_currency: string
          id: string
          markup_type: string
          markup_value: number
          service_fee_type: string
          service_fee_value: number
          updated_at: string
          updated_by: string | null
          upsells_enabled: boolean
        }
        Insert: {
          default_currency?: string
          id?: string
          markup_type?: string
          markup_value?: number
          service_fee_type?: string
          service_fee_value?: number
          updated_at?: string
          updated_by?: string | null
          upsells_enabled?: boolean
        }
        Update: {
          default_currency?: string
          id?: string
          markup_type?: string
          markup_value?: number
          service_fee_type?: string
          service_fee_value?: number
          updated_at?: string
          updated_by?: string | null
          upsells_enabled?: boolean
        }
        Relationships: []
      }
      credit_costs: {
        Row: {
          active: boolean
          cost: number
          created_at: string
          description: string | null
          feature_key: string
          label: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          cost: number
          created_at?: string
          description?: string | null
          feature_key: string
          label: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          cost?: number
          created_at?: string
          description?: string | null
          feature_key?: string
          label?: string
          updated_at?: string
        }
        Relationships: []
      }
      credit_ledger: {
        Row: {
          created_at: string
          delta: number
          id: string
          metadata: Json
          reason: string
          stripe_session_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          metadata?: Json
          reason: string
          stripe_session_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          metadata?: Json
          reason?: string
          stripe_session_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string
          id: string
          kind: string
          payload: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          payload: Json
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
          user_id?: string
        }
        Relationships: []
      }
      file_translations: {
        Row: {
          created_at: string
          credits_spent: number
          error_message: string | null
          file_name: string
          file_size_bytes: number | null
          file_type: string
          id: string
          source_lang: string | null
          status: string
          storage_path_original: string | null
          storage_path_translated: string | null
          target_lang: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits_spent?: number
          error_message?: string | null
          file_name: string
          file_size_bytes?: number | null
          file_type: string
          id?: string
          source_lang?: string | null
          status?: string
          storage_path_original?: string | null
          storage_path_translated?: string | null
          target_lang: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits_spent?: number
          error_message?: string | null
          file_name?: string
          file_size_bytes?: number | null
          file_type?: string
          id?: string
          source_lang?: string | null
          status?: string
          storage_path_original?: string | null
          storage_path_translated?: string | null
          target_lang?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      flight_alerts: {
        Row: {
          active: boolean
          created_at: string
          destination: string
          end_date: string | null
          id: string
          max_price: number | null
          origin: string
          start_date: string | null
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          destination: string
          end_date?: string | null
          id?: string
          max_price?: number | null
          origin: string
          start_date?: string | null
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          destination?: string
          end_date?: string | null
          id?: string
          max_price?: number | null
          origin?: string
          start_date?: string | null
          user_id?: string
        }
        Relationships: []
      }
      flight_orders: {
        Row: {
          booking_reference: string | null
          created_at: string
          duffel_order_id: string
          id: string
          passengers: Json
          raw: Json | null
          slices: Json
          status: string
          total_amount: number | null
          total_currency: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          booking_reference?: string | null
          created_at?: string
          duffel_order_id: string
          id?: string
          passengers?: Json
          raw?: Json | null
          slices?: Json
          status?: string
          total_amount?: number | null
          total_currency?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          booking_reference?: string | null
          created_at?: string
          duffel_order_id?: string
          id?: string
          passengers?: Json
          raw?: Json | null
          slices?: Json
          status?: string
          total_amount?: number | null
          total_currency?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fx_rates: {
        Row: {
          base_currency: string
          fetched_at: string
          id: string
          quote_currency: string
          rate: number
        }
        Insert: {
          base_currency: string
          fetched_at?: string
          id?: string
          quote_currency: string
          rate: number
        }
        Update: {
          base_currency?: string
          fetched_at?: string
          id?: string
          quote_currency?: string
          rate?: number
        }
        Relationships: []
      }
      itineraries: {
        Row: {
          activities: Json
          created_at: string
          day_date: string | null
          day_number: number
          estimated_cost: number | null
          id: string
          title: string | null
          trip_id: string
          user_id: string
        }
        Insert: {
          activities?: Json
          created_at?: string
          day_date?: string | null
          day_number: number
          estimated_cost?: number | null
          id?: string
          title?: string | null
          trip_id: string
          user_id: string
        }
        Update: {
          activities?: Json
          created_at?: string
          day_date?: string | null
          day_number?: number
          estimated_cost?: number | null
          id?: string
          title?: string | null
          trip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "itineraries_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      live_room_messages: {
        Row: {
          created_at: string
          from_lang: string
          from_name: string
          from_user_id: string
          id: string
          original_text: string
          per_recipient: Json
          room_code: string
        }
        Insert: {
          created_at?: string
          from_lang: string
          from_name: string
          from_user_id: string
          id?: string
          original_text: string
          per_recipient?: Json
          room_code: string
        }
        Update: {
          created_at?: string
          from_lang?: string
          from_name?: string
          from_user_id?: string
          id?: string
          original_text?: string
          per_recipient?: Json
          room_code?: string
        }
        Relationships: []
      }
      pending_flight_bookings: {
        Row: {
          breakdown: Json
          created_at: string
          duffel_order_id: string | null
          error: string | null
          final_amount: number
          final_currency: string
          id: string
          offer_id: string
          original_amount: number
          original_currency: string
          passengers: Json
          payment_session_id: string | null
          payment_status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          breakdown?: Json
          created_at?: string
          duffel_order_id?: string | null
          error?: string | null
          final_amount: number
          final_currency: string
          id?: string
          offer_id: string
          original_amount: number
          original_currency: string
          passengers?: Json
          payment_session_id?: string | null
          payment_status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          breakdown?: Json
          created_at?: string
          duffel_order_id?: string | null
          error?: string | null
          final_amount?: number
          final_currency?: string
          id?: string
          offer_id?: string
          original_amount?: number
          original_currency?: string
          passengers?: Json
          payment_session_id?: string | null
          payment_status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          preferred_currency: string
          preferred_language: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          preferred_currency?: string
          preferred_language?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          preferred_currency?: string
          preferred_language?: string
          updated_at?: string
        }
        Relationships: []
      }
      stay_orders: {
        Row: {
          accommodation_name: string | null
          check_in_date: string | null
          check_out_date: string | null
          created_at: string
          duffel_booking_id: string
          guests: number | null
          id: string
          raw: Json | null
          reference: string | null
          rooms: number | null
          status: string
          total_amount: number | null
          total_currency: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          accommodation_name?: string | null
          check_in_date?: string | null
          check_out_date?: string | null
          created_at?: string
          duffel_booking_id: string
          guests?: number | null
          id?: string
          raw?: Json | null
          reference?: string | null
          rooms?: number | null
          status?: string
          total_amount?: number | null
          total_currency?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          accommodation_name?: string | null
          check_in_date?: string | null
          check_out_date?: string | null
          created_at?: string
          duffel_booking_id?: string
          guests?: number | null
          id?: string
          raw?: Json | null
          reference?: string | null
          rooms?: number | null
          status?: string
          total_amount?: number | null
          total_currency?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          price_id: string
          product_id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id: string
          product_id: string
          status?: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id?: string
          product_id?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      translations_history: {
        Row: {
          context_explanation: string | null
          created_at: string
          id: string
          kind: string
          source_lang: string | null
          source_text: string
          target_lang: string
          translated_text: string
          user_id: string
        }
        Insert: {
          context_explanation?: string | null
          created_at?: string
          id?: string
          kind?: string
          source_lang?: string | null
          source_text: string
          target_lang: string
          translated_text: string
          user_id: string
        }
        Update: {
          context_explanation?: string | null
          created_at?: string
          id?: string
          kind?: string
          source_lang?: string | null
          source_text?: string
          target_lang?: string
          translated_text?: string
          user_id?: string
        }
        Relationships: []
      }
      trips: {
        Row: {
          ai_summary: Json | null
          budget_currency: string
          budget_total: number | null
          cover_image_url: string | null
          created_at: string
          destination: string
          end_date: string
          id: string
          origin: string
          start_date: string
          status: string
          title: string
          travel_style: string | null
          travelers: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_summary?: Json | null
          budget_currency?: string
          budget_total?: number | null
          cover_image_url?: string | null
          created_at?: string
          destination: string
          end_date: string
          id?: string
          origin: string
          start_date: string
          status?: string
          title: string
          travel_style?: string | null
          travelers?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_summary?: Json | null
          budget_currency?: string
          budget_total?: number | null
          cover_image_url?: string | null
          created_at?: string
          destination?: string
          end_date?: string
          id?: string
          origin?: string
          start_date?: string
          status?: string
          title?: string
          travel_style?: string | null
          travelers?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_credits: {
        Row: {
          balance: number | null
          created_at: string
          free_balance: number
          lifetime_purchased: number
          lifetime_spent: number
          monthly_balance: number
          monthly_grant: number
          monthly_reset_at: string | null
          topup_balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number | null
          created_at?: string
          free_balance?: number
          lifetime_purchased?: number
          lifetime_spent?: number
          monthly_balance?: number
          monthly_grant?: number
          monthly_reset_at?: string | null
          topup_balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number | null
          created_at?: string
          free_balance?: number
          lifetime_purchased?: number
          lifetime_spent?: number
          monthly_balance?: number
          monthly_grant?: number
          monthly_reset_at?: string | null
          topup_balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_alerts: {
        Row: {
          created_at: string
          id: string
          kind: string
          message: string
          read: boolean
          severity: string
          user_id: string
          wallet_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          message: string
          read?: boolean
          severity?: string
          user_id: string
          wallet_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          message?: string
          read?: boolean
          severity?: string
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_alerts_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_budgets: {
        Row: {
          created_at: string
          currency: string
          daily_budget: number
          emergency_reserve: number
          end_date: string | null
          id: string
          start_date: string | null
          total_budget: number
          trip_id: string | null
          updated_at: string
          user_id: string
          wallet_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          daily_budget?: number
          emergency_reserve?: number
          end_date?: string | null
          id?: string
          start_date?: string | null
          total_budget?: number
          trip_id?: string | null
          updated_at?: string
          user_id: string
          wallet_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          daily_budget?: number
          emergency_reserve?: number
          end_date?: string | null
          id?: string
          start_date?: string | null
          total_budget?: number
          trip_id?: string | null
          updated_at?: string
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_budgets_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: true
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_expenses: {
        Row: {
          amount: number
          amount_in_main: number
          category: string
          country: string | null
          created_at: string
          currency: string
          fx_rate_used: number
          id: string
          merchant: string | null
          notes: string | null
          occurred_at: string
          raw_ocr: Json | null
          receipt_url: string | null
          source: string
          trip_id: string | null
          updated_at: string
          user_id: string
          wallet_id: string
        }
        Insert: {
          amount: number
          amount_in_main: number
          category?: string
          country?: string | null
          created_at?: string
          currency: string
          fx_rate_used?: number
          id?: string
          merchant?: string | null
          notes?: string | null
          occurred_at?: string
          raw_ocr?: Json | null
          receipt_url?: string | null
          source?: string
          trip_id?: string | null
          updated_at?: string
          user_id: string
          wallet_id: string
        }
        Update: {
          amount?: number
          amount_in_main?: number
          category?: string
          country?: string | null
          created_at?: string
          currency?: string
          fx_rate_used?: number
          id?: string
          merchant?: string | null
          notes?: string | null
          occurred_at?: string
          raw_ocr?: Json | null
          receipt_url?: string | null
          source?: string
          trip_id?: string | null
          updated_at?: string
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_expenses_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          created_at: string
          id: string
          initial_balance: number
          main_currency: string
          name: string
          trip_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          initial_balance?: number
          main_currency?: string
          name: string
          trip_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          initial_balance?: number
          main_currency?: string
          name?: string
          trip_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_credits: {
        Args: {
          _amount: number
          _bucket?: string
          _meta?: Json
          _reason: string
          _session?: string
          _user: string
        }
        Returns: undefined
      }
      grant_monthly_credits: {
        Args: { _amount: number; _user: string }
        Returns: undefined
      }
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
      has_premium_access: { Args: { user_uuid: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      process_monthly_resets: { Args: never; Returns: number }
      spend_credits: {
        Args: { _amount: number; _meta?: Json; _reason: string; _user: string }
        Returns: boolean
      }
      spend_for_feature: {
        Args: { _feature: string; _meta?: Json; _user: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "free" | "premium" | "ultra" | "admin"
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
    Enums: {
      app_role: ["free", "premium", "ultra", "admin"],
    },
  },
} as const
