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
      admin_emails: {
        Row: {
          email: string
        }
        Insert: {
          email: string
        }
        Update: {
          email?: string
        }
        Relationships: []
      }
      client_credentials: {
        Row: {
          client_id: string
          created_at: string
          encrypted_password: string
          id: string
          last_rotated: string
          notes: string | null
          service_name: string
          username: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          encrypted_password: string
          id?: string
          last_rotated?: string
          notes?: string | null
          service_name: string
          username?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          encrypted_password?: string
          id?: string
          last_rotated?: string
          notes?: string | null
          service_name?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_credentials_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_notes: {
        Row: {
          client_id: string
          content: string
          created_at: string
          created_by: string | null
          id: string
          is_draft: boolean
          note_type: Database["public"]["Enums"]["note_type"]
        }
        Insert: {
          client_id: string
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_draft?: boolean
          note_type?: Database["public"]["Enums"]["note_type"]
        }
        Update: {
          client_id?: string
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_draft?: boolean
          note_type?: Database["public"]["Enums"]["note_type"]
        }
        Relationships: [
          {
            foreignKeyName: "client_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      client_system_users: {
        Row: {
          admin_contact: string | null
          admin_name: string | null
          client_id: string
          created_at: string
          id: string
          last_verified_date: string | null
          roles_breakdown: string | null
          user_count: number
        }
        Insert: {
          admin_contact?: string | null
          admin_name?: string | null
          client_id: string
          created_at?: string
          id?: string
          last_verified_date?: string | null
          roles_breakdown?: string | null
          user_count?: number
        }
        Update: {
          admin_contact?: string | null
          admin_name?: string | null
          client_id?: string
          created_at?: string
          id?: string
          last_verified_date?: string | null
          roles_breakdown?: string | null
          user_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_system_users_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          app_status: Database["public"]["Enums"]["app_status"]
          app_url: string | null
          build_stage: Database["public"]["Enums"]["build_stage"]
          build_started_at: string | null
          built_by: string | null
          business_name: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          hosting_account_id: string | null
          id: string
          industry: string | null
          onboarded_by: string | null
          project_name: string | null
          shipped_at: string | null
          signed_date: string
          status: Database["public"]["Enums"]["client_status"]
          suspended_at: string | null
          suspension_reason: string | null
        }
        Insert: {
          app_status?: Database["public"]["Enums"]["app_status"]
          app_url?: string | null
          build_stage?: Database["public"]["Enums"]["build_stage"]
          build_started_at?: string | null
          built_by?: string | null
          business_name: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          hosting_account_id?: string | null
          id?: string
          industry?: string | null
          onboarded_by?: string | null
          project_name?: string | null
          shipped_at?: string | null
          signed_date?: string
          status?: Database["public"]["Enums"]["client_status"]
          suspended_at?: string | null
          suspension_reason?: string | null
        }
        Update: {
          app_status?: Database["public"]["Enums"]["app_status"]
          app_url?: string | null
          build_stage?: Database["public"]["Enums"]["build_stage"]
          build_started_at?: string | null
          built_by?: string | null
          business_name?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          hosting_account_id?: string | null
          id?: string
          industry?: string | null
          onboarded_by?: string | null
          project_name?: string | null
          shipped_at?: string | null
          signed_date?: string
          status?: Database["public"]["Enums"]["client_status"]
          suspended_at?: string | null
          suspension_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_built_by_fkey"
            columns: ["built_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_hosting_account_id_fkey"
            columns: ["hosting_account_id"]
            isOneToOne: false
            referencedRelation: "lovable_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_onboarded_by_fkey"
            columns: ["onboarded_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      commissions: {
        Row: {
          amount: number
          client_id: string | null
          created_at: string
          id: string
          payment_id: string | null
          rep_id: string | null
          status: Database["public"]["Enums"]["commission_status"]
          type: Database["public"]["Enums"]["commission_type"]
        }
        Insert: {
          amount?: number
          client_id?: string | null
          created_at?: string
          id?: string
          payment_id?: string | null
          rep_id?: string | null
          status?: Database["public"]["Enums"]["commission_status"]
          type?: Database["public"]["Enums"]["commission_type"]
        }
        Update: {
          amount?: number
          client_id?: string | null
          created_at?: string
          id?: string
          payment_id?: string | null
          rep_id?: string | null
          status?: Database["public"]["Enums"]["commission_status"]
          type?: Database["public"]["Enums"]["commission_type"]
        }
        Relationships: [
          {
            foreignKeyName: "commissions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      credential_access_log: {
        Row: {
          accessed_at: string
          accessed_by: string | null
          action: string
          credential_id: string
          id: string
        }
        Insert: {
          accessed_at?: string
          accessed_by?: string | null
          action?: string
          credential_id: string
          id?: string
        }
        Update: {
          accessed_at?: string
          accessed_by?: string | null
          action?: string
          credential_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credential_access_log_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: false
            referencedRelation: "client_credentials"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_events: {
        Row: {
          action: string
          actor: string | null
          change_reason: string | null
          created_at: string
          entity_id: string | null
          entity_table: string
          id: string
          payload: Json | null
        }
        Insert: {
          action: string
          actor?: string | null
          change_reason?: string | null
          created_at?: string
          entity_id?: string | null
          entity_table: string
          id?: string
          payload?: Json | null
        }
        Update: {
          action?: string
          actor?: string | null
          change_reason?: string | null
          created_at?: string
          entity_id?: string | null
          entity_table?: string
          id?: string
          payload?: Json | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          date: string
          id: string
          note: string | null
          paid_by: string | null
          vendor: string | null
        }
        Insert: {
          amount: number
          category?: string
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          paid_by?: string | null
          vendor?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          paid_by?: string | null
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      library_prompts: {
        Row: {
          body: string
          category: string | null
          created_at: string
          created_by: string | null
          id: string
          sort_order: number
          title: string
        }
        Insert: {
          body: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          sort_order?: number
          title: string
        }
        Update: {
          body?: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          sort_order?: number
          title?: string
        }
        Relationships: []
      }
      library_skills: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          file_name: string | null
          file_path: string | null
          id: string
          link: string | null
          sort_order: number
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          link?: string | null
          sort_order?: number
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          link?: string | null
          sort_order?: number
          title?: string
        }
        Relationships: []
      }
      library_themes: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          image_path: string | null
          image_url: string | null
          notes: string | null
          sort_order: number
          source_url: string | null
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          image_path?: string | null
          image_url?: string | null
          notes?: string | null
          sort_order?: number
          source_url?: string | null
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          image_path?: string | null
          image_url?: string | null
          notes?: string | null
          sort_order?: number
          source_url?: string | null
          title?: string
        }
        Relationships: []
      }
      lovable_accounts: {
        Row: {
          created_at: string
          credits_checked_at: string | null
          credits_remaining: number
          email: string
          encrypted_password: string | null
          id: string
          is_active: boolean
          label: string | null
          notes: string | null
          plan: string | null
          recovery_email: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          credits_checked_at?: string | null
          credits_remaining?: number
          email: string
          encrypted_password?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          notes?: string | null
          plan?: string | null
          recovery_email?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          credits_checked_at?: string | null
          credits_remaining?: number
          email?: string
          encrypted_password?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          notes?: string | null
          plan?: string | null
          recovery_email?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payment_reminders: {
        Row: {
          channel: string
          client_id: string
          created_at: string
          due_date: string
          id: string
          message: string | null
          sent_at: string
          sent_by: string | null
        }
        Insert: {
          channel?: string
          client_id: string
          created_at?: string
          due_date: string
          id?: string
          message?: string | null
          sent_at?: string
          sent_by?: string | null
        }
        Update: {
          channel?: string
          client_id?: string
          created_at?: string
          due_date?: string
          id?: string
          message?: string | null
          sent_at?: string
          sent_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_reminders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reminders_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          client_id: string
          covers_period_end: string
          covers_period_start: string
          created_at: string
          id: string
          method: string | null
          months_covered: number
          note: string | null
          payment_date: string
        }
        Insert: {
          amount: number
          client_id: string
          covers_period_end?: string
          covers_period_start?: string
          created_at?: string
          id?: string
          method?: string | null
          months_covered?: number
          note?: string | null
          payment_date?: string
        }
        Update: {
          amount?: number
          client_id?: string
          covers_period_end?: string
          covers_period_start?: string
          created_at?: string
          id?: string
          method?: string | null
          months_covered?: number
          note?: string | null
          payment_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean
          job_title: string | null
          phone: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          job_title?: string | null
          phone?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          job_title?: string | null
          phone?: string | null
          username?: string | null
        }
        Relationships: []
      }
      project_transfers: {
        Row: {
          client_id: string
          created_at: string
          from_account_id: string | null
          id: string
          moved_at: string
          moved_by: string | null
          note: string | null
          to_account_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          from_account_id?: string | null
          id?: string
          moved_at?: string
          moved_by?: string | null
          note?: string | null
          to_account_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          from_account_id?: string | null
          id?: string
          moved_at?: string
          moved_by?: string | null
          note?: string | null
          to_account_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_transfers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_transfers_from_account_id_fkey"
            columns: ["from_account_id"]
            isOneToOne: false
            referencedRelation: "lovable_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_transfers_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "lovable_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          app_url: string | null
          build_stage: Database["public"]["Enums"]["build_stage"]
          built_by: string | null
          client_id: string
          created_at: string
          due_at: string | null
          hosting_account_id: string | null
          id: string
          notes: string | null
          payment_state: string
          project_name: string
          prospect_id: string | null
          shipped_at: string | null
          started_at: string | null
          updated_at: string
        }
        Insert: {
          app_url?: string | null
          build_stage?: Database["public"]["Enums"]["build_stage"]
          built_by?: string | null
          client_id: string
          created_at?: string
          due_at?: string | null
          hosting_account_id?: string | null
          id?: string
          notes?: string | null
          payment_state?: string
          project_name: string
          prospect_id?: string | null
          shipped_at?: string | null
          started_at?: string | null
          updated_at?: string
        }
        Update: {
          app_url?: string | null
          build_stage?: Database["public"]["Enums"]["build_stage"]
          built_by?: string | null
          client_id?: string
          created_at?: string
          due_at?: string | null
          hosting_account_id?: string | null
          id?: string
          notes?: string | null
          payment_state?: string
          project_name?: string
          prospect_id?: string | null
          shipped_at?: string | null
          started_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_built_by_fkey"
            columns: ["built_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_hosting_account_id_fkey"
            columns: ["hosting_account_id"]
            isOneToOne: false
            referencedRelation: "lovable_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      prospects: {
        Row: {
          assigned_rep: string | null
          business_name: string
          client_id: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          id: string
          industry: string | null
          source: string | null
          stage: Database["public"]["Enums"]["prospect_stage"]
        }
        Insert: {
          assigned_rep?: string | null
          business_name: string
          client_id?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          source?: string | null
          stage?: Database["public"]["Enums"]["prospect_stage"]
        }
        Update: {
          assigned_rep?: string | null
          business_name?: string
          client_id?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          source?: string | null
          stage?: Database["public"]["Enums"]["prospect_stage"]
        }
        Relationships: [
          {
            foreignKeyName: "prospects_assigned_rep_fkey"
            columns: ["assigned_rep"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          created_at: string
          date: string
          id: string
          new_prospect_id: string | null
          referring_client_id: string | null
          referring_rep_id: string | null
          reward_status: string | null
          reward_type: string | null
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          new_prospect_id?: string | null
          referring_client_id?: string | null
          referring_rep_id?: string | null
          reward_status?: string | null
          reward_type?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          new_prospect_id?: string | null
          referring_client_id?: string | null
          referring_rep_id?: string | null
          reward_status?: string | null
          reward_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referrals_new_prospect_id_fkey"
            columns: ["new_prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referring_client_id_fkey"
            columns: ["referring_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referring_rep_id_fkey"
            columns: ["referring_rep_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      service_logs: {
        Row: {
          category: Database["public"]["Enums"]["service_category"]
          client_id: string
          created_at: string
          date: string
          description: string
          id: string
          logged_by: string | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["service_category"]
          client_id: string
          created_at?: string
          date?: string
          description: string
          id?: string
          logged_by?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["service_category"]
          client_id?: string
          created_at?: string
          date?: string
          description?: string
          id?: string
          logged_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_logs_logged_by_fkey"
            columns: ["logged_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          billing_cycle: string
          client_id: string
          created_at: string
          id: string
          monthly_rate: number
          start_date: string
          status: Database["public"]["Enums"]["sub_status"]
        }
        Insert: {
          billing_cycle?: string
          client_id: string
          created_at?: string
          id?: string
          monthly_rate?: number
          start_date?: string
          status?: Database["public"]["Enums"]["sub_status"]
        }
        Update: {
          billing_cycle?: string
          client_id?: string
          created_at?: string
          id?: string
          monthly_rate?: number
          start_date?: string
          status?: Database["public"]["Enums"]["sub_status"]
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          active: boolean
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          role: string
          salary: number
          user_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          phone?: string | null
          role?: string
          salary?: number
          user_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          role?: string
          salary?: number
          user_id?: string | null
        }
        Relationships: []
      }
      team_payouts: {
        Row: {
          amount: number
          created_at: string
          date_sent: string
          id: string
          method: Database["public"]["Enums"]["payout_method"]
          note: string | null
          reference: string | null
          team_member_id: string | null
          type: Database["public"]["Enums"]["payout_type"]
        }
        Insert: {
          amount: number
          created_at?: string
          date_sent?: string
          id?: string
          method?: Database["public"]["Enums"]["payout_method"]
          note?: string | null
          reference?: string | null
          team_member_id?: string | null
          type?: Database["public"]["Enums"]["payout_type"]
        }
        Update: {
          amount?: number
          created_at?: string
          date_sent?: string
          id?: string
          method?: Database["public"]["Enums"]["payout_method"]
          note?: string | null
          reference?: string | null
          team_member_id?: string | null
          type?: Database["public"]["Enums"]["payout_type"]
        }
        Relationships: [
          {
            foreignKeyName: "team_payouts_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string | null
          direction: string
          id: string
          method: string
          note: string | null
          occurred_at: string
          payee: string | null
          source_id: string | null
          source_table: string
          updated_at: string
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          direction?: string
          id?: string
          method?: string
          note?: string | null
          occurred_at?: string
          payee?: string | null
          source_id?: string | null
          source_table?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          direction?: string
          id?: string
          method?: string
          note?: string | null
          occurred_at?: string
          payee?: string | null
          source_id?: string | null
          source_table?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_page_access: {
        Row: {
          allowed: boolean
          created_at: string
          id: string
          page_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          allowed?: boolean
          created_at?: string
          id?: string
          page_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          allowed?: boolean
          created_at?: string
          id?: string
          page_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      weekly_snapshots: {
        Row: {
          active_clients: number
          churned_clients: number
          deals_closed: number
          id: string
          new_leads: number
          revenue_collected: number
          week_start: string
        }
        Insert: {
          active_clients?: number
          churned_clients?: number
          deals_closed?: number
          id?: string
          new_leads?: number
          revenue_collected?: number
          week_start: string
        }
        Update: {
          active_clients?: number
          churned_clients?: number
          deals_closed?: number
          id?: string
          new_leads?: number
          revenue_collected?: number
          week_start?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bootstrap_me: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      my_member_id: { Args: never; Returns: string }
      owns_client: { Args: { _client_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "sales" | "dev" | "support"
      app_status: "Live" | "Suspended" | "Closed"
      build_stage: "Planning" | "Building" | "Testing" | "Shipped"
      client_status: "Active" | "Paused" | "Churned"
      commission_status: "Pending" | "Paid"
      commission_type: "Signing Bonus" | "Recurring %"
      note_type: "General" | "Prompt Draft" | "Spec"
      payout_method: "Check" | "Mobile Money" | "Bank"
      payout_type: "Commission" | "Salary" | "Reimbursement"
      prospect_stage: "Contacted" | "Demo" | "Negotiating" | "Signed" | "Lost"
      service_category: "Bug Fix" | "Feature" | "Maintenance" | "Support Call"
      sub_status: "Active" | "Paused" | "Cancelled"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "sales", "dev", "support"],
      app_status: ["Live", "Suspended", "Closed"],
      build_stage: ["Planning", "Building", "Testing", "Shipped"],
      client_status: ["Active", "Paused", "Churned"],
      commission_status: ["Pending", "Paid"],
      commission_type: ["Signing Bonus", "Recurring %"],
      note_type: ["General", "Prompt Draft", "Spec"],
      payout_method: ["Check", "Mobile Money", "Bank"],
      payout_type: ["Commission", "Salary", "Reimbursement"],
      prospect_stage: ["Contacted", "Demo", "Negotiating", "Signed", "Lost"],
      service_category: ["Bug Fix", "Feature", "Maintenance", "Support Call"],
      sub_status: ["Active", "Paused", "Cancelled"],
    },
  },
} as const
