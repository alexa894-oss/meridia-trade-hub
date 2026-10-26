// Generado desde Supabase (MCP generate_typescript_types). No editar a mano.
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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      buyer_details: {
        Row: {
          account_type: Database["public"]["Enums"]["buyer_account_type"]
          company_id: string
          full_name: string | null
          legal_name: string | null
          project_description: string | null
          tax_id: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          account_type: Database["public"]["Enums"]["buyer_account_type"]
          company_id: string
          full_name?: string | null
          legal_name?: string | null
          project_description?: string | null
          tax_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          account_type?: Database["public"]["Enums"]["buyer_account_type"]
          company_id?: string
          full_name?: string | null
          legal_name?: string | null
          project_description?: string | null
          tax_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "buyer_details_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          active: boolean
          created_at: string
          id: string
          names: Json
          slug: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          names: Json
          slug: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          names?: Json
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      commissions: {
        Row: {
          amount: number
          base_amount: number
          created_at: string
          currency: string
          due_date: string | null
          factory_company_id: string
          id: string
          invoiced_at: string | null
          order_id: string
          paid_at: string | null
          paid_marked_by: string | null
          rate_pct: number
          status: Database["public"]["Enums"]["commission_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          base_amount: number
          created_at?: string
          currency: string
          due_date?: string | null
          factory_company_id: string
          id?: string
          invoiced_at?: string | null
          order_id: string
          paid_at?: string | null
          paid_marked_by?: string | null
          rate_pct: number
          status?: Database["public"]["Enums"]["commission_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          base_amount?: number
          created_at?: string
          currency?: string
          due_date?: string | null
          factory_company_id?: string
          id?: string
          invoiced_at?: string | null
          order_id?: string
          paid_at?: string | null
          paid_marked_by?: string | null
          rate_pct?: number
          status?: Database["public"]["Enums"]["commission_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commissions_factory_company_id_fkey"
            columns: ["factory_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          country: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["company_kind"]
          sector_id: string | null
          status: Database["public"]["Enums"]["company_status"]
          submitted_at: string | null
          updated_at: string
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          country: string
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["company_kind"]
          sector_id?: string | null
          status?: Database["public"]["Enums"]["company_status"]
          submitted_at?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          country?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["company_kind"]
          sector_id?: string | null
          status?: Database["public"]["Enums"]["company_status"]
          submitted_at?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      company_contacts: {
        Row: {
          company_id: string
          contact_name: string
          contact_title: string | null
          email: string | null
          phone: string | null
          updated_at: string
          wechat: string | null
        }
        Insert: {
          company_id: string
          contact_name: string
          contact_title?: string | null
          email?: string | null
          phone?: string | null
          updated_at?: string
          wechat?: string | null
        }
        Update: {
          company_id?: string
          contact_name?: string
          contact_title?: string | null
          email?: string | null
          phone?: string | null
          updated_at?: string
          wechat?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_documents: {
        Row: {
          company_id: string
          created_at: string
          file_name: string | null
          id: string
          kind: Database["public"]["Enums"]["company_document_kind"]
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          company_id: string
          created_at?: string
          file_name?: string | null
          id?: string
          kind: Database["public"]["Enums"]["company_document_kind"]
          storage_path: string
          uploaded_by: string
        }
        Update: {
          company_id?: string
          created_at?: string
          file_name?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["company_document_kind"]
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_reviews: {
        Row: {
          action: Database["public"]["Enums"]["company_review_action"]
          actor_id: string
          company_id: string
          created_at: string
          id: string
          message: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["company_review_action"]
          actor_id: string
          company_id: string
          created_at?: string
          id?: string
          message?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["company_review_action"]
          actor_id?: string
          company_id?: string
          created_at?: string
          id?: string
          message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_reviews_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_reads: {
        Row: {
          conversation_id: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_reads_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          factory_company_id: string
          id: string
          last_message_at: string | null
          rfq_id: string
        }
        Insert: {
          created_at?: string
          factory_company_id: string
          id?: string
          last_message_at?: string | null
          rfq_id: string
        }
        Update: {
          created_at?: string
          factory_company_id?: string
          id?: string
          last_message_at?: string | null
          rfq_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_factory_company_id_fkey"
            columns: ["factory_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
        ]
      }
      factory_admin: {
        Row: {
          commission_rate: number | null
          company_id: string
          notes: string | null
          tier: Database["public"]["Enums"]["factory_tier"] | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          commission_rate?: number | null
          company_id: string
          notes?: string | null
          tier?: Database["public"]["Enums"]["factory_tier"] | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          commission_rate?: number | null
          company_id?: string
          notes?: string | null
          tier?: Database["public"]["Enums"]["factory_tier"] | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "factory_admin_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      factory_categories: {
        Row: {
          category_id: string
          factory_company_id: string
        }
        Insert: {
          category_id: string
          factory_company_id: string
        }
        Update: {
          category_id?: string
          factory_company_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "factory_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factory_categories_factory_company_id_fkey"
            columns: ["factory_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      factory_details: {
        Row: {
          annual_capacity_or_sales: string | null
          annual_figure_verified: boolean
          brochure_path: string | null
          capacity: string | null
          city: string
          company_id: string
          departure_port: string | null
          founded_year: number | null
          founded_year_verified: boolean
          legal_name_en: string
          legal_name_zh: string
          province: string
          updated_at: string
          website: string | null
        }
        Insert: {
          annual_capacity_or_sales?: string | null
          annual_figure_verified?: boolean
          brochure_path?: string | null
          capacity?: string | null
          city: string
          company_id: string
          departure_port?: string | null
          founded_year?: number | null
          founded_year_verified?: boolean
          legal_name_en: string
          legal_name_zh: string
          province: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          annual_capacity_or_sales?: string | null
          annual_figure_verified?: boolean
          brochure_path?: string | null
          capacity?: string | null
          city?: string
          company_id?: string
          departure_port?: string | null
          founded_year?: number | null
          founded_year_verified?: boolean
          legal_name_en?: string
          legal_name_zh?: string
          province?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "factory_details_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      factory_memberships: {
        Row: {
          created_at: string
          created_by: string | null
          ends_at: string | null
          factory_company_id: string
          id: string
          plan_id: string
          starts_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          factory_company_id: string
          id?: string
          plan_id: string
          starts_at: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          factory_company_id?: string
          id?: string
          plan_id?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "factory_memberships_factory_company_id_fkey"
            columns: ["factory_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factory_memberships_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "membership_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_acceptances: {
        Row: {
          accepted_at: string
          id: string
          legal_document_id: string
          user_id: string
        }
        Insert: {
          accepted_at?: string
          id?: string
          legal_document_id: string
          user_id: string
        }
        Update: {
          accepted_at?: string
          id?: string
          legal_document_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_acceptances_legal_document_id_fkey"
            columns: ["legal_document_id"]
            isOneToOne: false
            referencedRelation: "legal_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_documents: {
        Row: {
          content: Json
          created_at: string
          created_by: string | null
          id: string
          is_draft: boolean
          kind: Database["public"]["Enums"]["legal_document_kind"]
          published_at: string | null
          version: number
        }
        Insert: {
          content: Json
          created_at?: string
          created_by?: string | null
          id?: string
          is_draft?: boolean
          kind: Database["public"]["Enums"]["legal_document_kind"]
          published_at?: string | null
          version: number
        }
        Update: {
          content?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          is_draft?: boolean
          kind?: Database["public"]["Enums"]["legal_document_kind"]
          published_at?: string | null
          version?: number
        }
        Relationships: []
      }
      membership_plans: {
        Row: {
          active: boolean
          benefits: string[]
          billing_period: Database["public"]["Enums"]["billing_period"]
          created_at: string
          currency: string
          description: string | null
          id: string
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          benefits?: string[]
          billing_period: Database["public"]["Enums"]["billing_period"]
          created_at?: string
          currency: string
          description?: string | null
          id?: string
          name: string
          price: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          benefits?: string[]
          billing_period?: Database["public"]["Enums"]["billing_period"]
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: []
      }
      message_attachments: {
        Row: {
          created_at: string
          file_name: string
          id: string
          message_id: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          message_id: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          message_id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          sender_id: string
          sender_kind: Database["public"]["Enums"]["message_sender_kind"]
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          sender_id: string
          sender_kind: Database["public"]["Enums"]["message_sender_kind"]
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          sender_id?: string
          sender_kind?: Database["public"]["Enums"]["message_sender_kind"]
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          payload: Json
          read_at: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          payload?: Json
          read_at?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          read_at?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      order_documents: {
        Row: {
          created_at: string
          file_name: string | null
          id: string
          kind: Database["public"]["Enums"]["order_document_kind"]
          order_id: string
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name?: string | null
          id?: string
          kind: Database["public"]["Enums"]["order_document_kind"]
          order_id: string
          storage_path: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["order_document_kind"]
          order_id?: string
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_documents_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          buyer_company_id: string
          created_at: string
          created_by: string
          currency: string
          factory_company_id: string
          id: string
          incoterm: Database["public"]["Enums"]["incoterm"]
          quantity: number
          quote_id: string
          received_confirmed_at: string | null
          rejection_reason: string | null
          rfq_id: string
          status: Database["public"]["Enums"]["order_status"]
          total_amount: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          buyer_company_id: string
          created_at?: string
          created_by: string
          currency: string
          factory_company_id: string
          id?: string
          incoterm: Database["public"]["Enums"]["incoterm"]
          quantity: number
          quote_id: string
          received_confirmed_at?: string | null
          rejection_reason?: string | null
          rfq_id: string
          status?: Database["public"]["Enums"]["order_status"]
          total_amount: number
          unit_price: number
          updated_at?: string
        }
        Update: {
          buyer_company_id?: string
          created_at?: string
          created_by?: string
          currency?: string
          factory_company_id?: string
          id?: string
          incoterm?: Database["public"]["Enums"]["incoterm"]
          quantity?: number
          quote_id?: string
          received_confirmed_at?: string | null
          rejection_reason?: string | null
          rfq_id?: string
          status?: Database["public"]["Enums"]["order_status"]
          total_amount?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_buyer_company_id_fkey"
            columns: ["buyer_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_factory_company_id_fkey"
            columns: ["factory_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: true
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          is_public: boolean
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          is_public?: boolean
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          is_public?: boolean
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      profiles: {
        Row: {
          company_id: string | null
          created_at: string
          full_name: string | null
          id: string
          locale: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          locale?: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          locale?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_prices: {
        Row: {
          incoterm: Database["public"]["Enums"]["incoterm"]
          quote_id: string
          unit_price: number
        }
        Insert: {
          incoterm: Database["public"]["Enums"]["incoterm"]
          quote_id: string
          unit_price: number
        }
        Update: {
          incoterm?: Database["public"]["Enums"]["incoterm"]
          quote_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_prices_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          alternative_differences: string | null
          balance_pct: number | null
          balance_timing: string | null
          created_at: string
          created_by: string
          currency: string | null
          departure_port: string | null
          deposit_pct: number | null
          deposit_timing: string | null
          factory_company_id: string
          hidden_by: string | null
          hidden_reason: string | null
          id: string
          moq: number | null
          moq_unit: string | null
          offer_type: Database["public"]["Enums"]["offer_type"]
          production_time_days: number | null
          reviewed_at: string | null
          rfq_id: string
          sample_available: boolean | null
          sample_cost: number | null
          sample_shipping_cost: number | null
          sample_shipping_free: boolean | null
          status: Database["public"]["Enums"]["quote_status"]
          submitted_at: string | null
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          alternative_differences?: string | null
          balance_pct?: number | null
          balance_timing?: string | null
          created_at?: string
          created_by: string
          currency?: string | null
          departure_port?: string | null
          deposit_pct?: number | null
          deposit_timing?: string | null
          factory_company_id: string
          hidden_by?: string | null
          hidden_reason?: string | null
          id?: string
          moq?: number | null
          moq_unit?: string | null
          offer_type?: Database["public"]["Enums"]["offer_type"]
          production_time_days?: number | null
          reviewed_at?: string | null
          rfq_id: string
          sample_available?: boolean | null
          sample_cost?: number | null
          sample_shipping_cost?: number | null
          sample_shipping_free?: boolean | null
          status?: Database["public"]["Enums"]["quote_status"]
          submitted_at?: string | null
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          alternative_differences?: string | null
          balance_pct?: number | null
          balance_timing?: string | null
          created_at?: string
          created_by?: string
          currency?: string | null
          departure_port?: string | null
          deposit_pct?: number | null
          deposit_timing?: string | null
          factory_company_id?: string
          hidden_by?: string | null
          hidden_reason?: string | null
          id?: string
          moq?: number | null
          moq_unit?: string | null
          offer_type?: Database["public"]["Enums"]["offer_type"]
          production_time_days?: number | null
          reviewed_at?: string | null
          rfq_id?: string
          sample_available?: boolean | null
          sample_cost?: number | null
          sample_shipping_cost?: number | null
          sample_shipping_free?: boolean | null
          status?: Database["public"]["Enums"]["quote_status"]
          submitted_at?: string | null
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_factory_company_id_fkey"
            columns: ["factory_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
        ]
      }
      rfq_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string
          factory_company_id: string
          id: string
          rfq_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          factory_company_id: string
          id?: string
          rfq_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          factory_company_id?: string
          id?: string
          rfq_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfq_assignments_factory_company_id_fkey"
            columns: ["factory_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_assignments_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
        ]
      }
      rfqs: {
        Row: {
          accepts_alternatives: boolean
          buyer_company_id: string
          category_id: string | null
          created_at: string
          created_by: string
          deadline: string | null
          description: string | null
          destination_country: string | null
          destination_port: string | null
          id: string
          incoterms: Database["public"]["Enums"]["incoterm"][]
          needs_sample: boolean
          number: number
          product: string | null
          quantity: number | null
          reference_image_path: string | null
          reference_url: string | null
          shipping_modes: Database["public"]["Enums"]["shipping_mode"][]
          status: Database["public"]["Enums"]["rfq_status"]
          submitted_at: string | null
          technical_specs: string | null
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          accepts_alternatives?: boolean
          buyer_company_id: string
          category_id?: string | null
          created_at?: string
          created_by: string
          deadline?: string | null
          description?: string | null
          destination_country?: string | null
          destination_port?: string | null
          id?: string
          incoterms?: Database["public"]["Enums"]["incoterm"][]
          needs_sample?: boolean
          number?: never
          product?: string | null
          quantity?: number | null
          reference_image_path?: string | null
          reference_url?: string | null
          shipping_modes?: Database["public"]["Enums"]["shipping_mode"][]
          status?: Database["public"]["Enums"]["rfq_status"]
          submitted_at?: string | null
          technical_specs?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          accepts_alternatives?: boolean
          buyer_company_id?: string
          category_id?: string | null
          created_at?: string
          created_by?: string
          deadline?: string | null
          description?: string | null
          destination_country?: string | null
          destination_port?: string | null
          id?: string
          incoterms?: Database["public"]["Enums"]["incoterm"][]
          needs_sample?: boolean
          number?: never
          product?: string | null
          quantity?: number | null
          reference_image_path?: string | null
          reference_url?: string | null
          shipping_modes?: Database["public"]["Enums"]["shipping_mode"][]
          status?: Database["public"]["Enums"]["rfq_status"]
          submitted_at?: string | null
          technical_specs?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfqs_buyer_company_id_fkey"
            columns: ["buyer_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfqs_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfqs_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      sectors: {
        Row: {
          active: boolean
          created_at: string
          id: string
          names: Json
          slug: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          names: Json
          slug: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          names?: Json
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      status_history: {
        Row: {
          actor_id: string | null
          created_at: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["audited_entity"]
          from_status: string | null
          id: number
          note: string | null
          to_status: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["audited_entity"]
          from_status?: string | null
          id?: never
          note?: string | null
          to_status: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["audited_entity"]
          from_status?: string | null
          id?: never
          note?: string | null
          to_status?: string
        }
        Relationships: []
      }
      units: {
        Row: {
          active: boolean
          created_at: string
          id: string
          names: Json
          slug: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          names: Json
          slug: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          names?: Json
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_alerts: { Args: never; Returns: Json }
      admin_assign_rfq: {
        Args: { p_factories: string[]; p_rfq: string }
        Returns: number
      }
      admin_hide_quote: {
        Args: { p_hide: boolean; p_quote: string; p_reason: string }
        Returns: undefined
      }
      admin_review_company: {
        Args: {
          p_action: Database["public"]["Enums"]["company_review_action"]
          p_company: string
          p_message?: string
          p_tier?: Database["public"]["Enums"]["factory_tier"]
        }
        Returns: undefined
      }
      admin_rfq_action: {
        Args: { p_action: string; p_message: string; p_rfq: string }
        Returns: undefined
      }
      admin_unassign_rfq: {
        Args: { p_factory: string; p_rfq: string }
        Returns: undefined
      }
      buyer_quote_action: {
        Args: { p_action: string; p_quote: string }
        Returns: undefined
      }
      can_access_conversation: {
        Args: { p_conversation: string }
        Returns: boolean
      }
      current_legal_documents: {
        Args: never
        Returns: {
          content: Json
          created_at: string
          created_by: string | null
          id: string
          is_draft: boolean
          kind: Database["public"]["Enums"]["legal_document_kind"]
          published_at: string | null
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "legal_documents"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      expire_quotes: { Args: { p_rfq: string }; Returns: undefined }
      find_contact_info: { Args: { p_text: string }; Returns: string }
      get_public_settings: { Args: never; Returns: Json }
      get_rfq_buyer_profile: {
        Args: { p_rfq: string }
        Returns: {
          country: string
          display_name: string
          is_verified: boolean
          sector_names: Json
          sector_slug: string
        }[]
      }
      get_rfq_factory_profiles: {
        Args: { p_rfq: string }
        Returns: {
          annual_capacity_or_sales: string
          category_ids: string[]
          city: string
          company_id: string
          founded_year: number
          is_verified: boolean
          legal_name_en: string
          legal_name_zh: string
          province: string
          tier: Database["public"]["Enums"]["factory_tier"]
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_assigned: { Args: { p_rfq: string }; Returns: boolean }
      mark_quotes_reviewed: { Args: { p_rfq: string }; Returns: undefined }
      my_company_editable: { Args: never; Returns: boolean }
      my_company_id: { Args: never; Returns: string }
      my_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      owns_rfq: { Args: { p_rfq: string }; Returns: boolean }
      register_company: { Args: { p_country: string }; Returns: string }
      setting: { Args: { p_key: string }; Returns: Json }
      storage_owner_id: { Args: { p_name: string }; Returns: string }
      submit_company_for_review: { Args: never; Returns: undefined }
      submit_quote: { Args: { p_quote: string }; Returns: undefined }
      submit_rfq: { Args: { p_rfq: string }; Returns: undefined }
    }
    Enums: {
      audited_entity: "company" | "rfq" | "quote" | "order" | "commission"
      billing_period:
        | "monthly"
        | "quarterly"
        | "semiannual"
        | "annual"
        | "one_time"
      buyer_account_type: "company" | "individual"
      commission_status: "registered" | "invoiced" | "paid" | "overdue"
      company_document_kind:
        | "tax_registration"
        | "id_document"
        | "cn_business_license"
        | "brochure"
        | "other"
      company_kind: "buyer" | "factory"
      company_review_action: "validate" | "request_info" | "reject" | "suspend"
      company_status:
        | "registered"
        | "in_review"
        | "validated"
        | "info_requested"
        | "rejected"
        | "suspended"
      factory_tier: "vip" | "standard"
      incoterm: "FOB" | "CIF" | "EXW"
      legal_document_kind: "terms" | "non_circumvention"
      message_sender_kind: "buyer" | "factory" | "meridia"
      offer_type: "exact" | "alternative"
      order_document_kind: "commercial_invoice" | "bill_of_lading" | "other"
      order_status:
        | "sent"
        | "confirmed"
        | "in_production"
        | "ready_to_ship"
        | "shipped"
        | "delivered"
        | "closed"
        | "rejected"
      quote_status:
        | "draft"
        | "submitted"
        | "reviewed"
        | "preferred"
        | "accepted"
        | "discarded"
        | "hidden"
        | "expired"
      rfq_status:
        | "draft"
        | "submitted"
        | "assigned"
        | "quoted"
        | "negotiating"
        | "order_created"
        | "info_requested"
        | "no_response"
        | "closed"
      shipping_mode: "FCL" | "LCL" | "air" | "samples" | "undecided"
      user_role: "buyer" | "factory" | "admin"
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
      audited_entity: ["company", "rfq", "quote", "order", "commission"],
      billing_period: [
        "monthly",
        "quarterly",
        "semiannual",
        "annual",
        "one_time",
      ],
      buyer_account_type: ["company", "individual"],
      commission_status: ["registered", "invoiced", "paid", "overdue"],
      company_document_kind: [
        "tax_registration",
        "id_document",
        "cn_business_license",
        "brochure",
        "other",
      ],
      company_kind: ["buyer", "factory"],
      company_review_action: ["validate", "request_info", "reject", "suspend"],
      company_status: [
        "registered",
        "in_review",
        "validated",
        "info_requested",
        "rejected",
        "suspended",
      ],
      factory_tier: ["vip", "standard"],
      incoterm: ["FOB", "CIF", "EXW"],
      legal_document_kind: ["terms", "non_circumvention"],
      message_sender_kind: ["buyer", "factory", "meridia"],
      offer_type: ["exact", "alternative"],
      order_document_kind: ["commercial_invoice", "bill_of_lading", "other"],
      order_status: [
        "sent",
        "confirmed",
        "in_production",
        "ready_to_ship",
        "shipped",
        "delivered",
        "closed",
        "rejected",
      ],
      quote_status: [
        "draft",
        "submitted",
        "reviewed",
        "preferred",
        "accepted",
        "discarded",
        "hidden",
        "expired",
      ],
      rfq_status: [
        "draft",
        "submitted",
        "assigned",
        "quoted",
        "negotiating",
        "order_created",
        "info_requested",
        "no_response",
        "closed",
      ],
      shipping_mode: ["FCL", "LCL", "air", "samples", "undecided"],
      user_role: ["buyer", "factory", "admin"],
    },
  },
} as const
