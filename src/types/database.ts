export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type UserRole = 'client' | 'admin' | 'reseller'
export type CurrencyCode = 'AKZ' | 'BRL' | 'USD'
export type PlanType = 'shared' | 'vps' | 'dedicated' | 'reseller'
export type ServiceStatus = 'pending' | 'active' | 'suspended' | 'cancelled' | 'expired'
export type DomainStatus = 'active' | 'expired' | 'pending' | 'transferred' | 'locked'
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed'
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical'
export type InvoiceStatus = 'pending' | 'paid' | 'overdue' | 'cancelled' | 'refunded'
export type PaymentMethod = 'credit_card' | 'paypal' | 'mercadopago' | 'pix' | 'bank_transfer' | 'multicaixa'
export type NotificationType = 'info' | 'warning' | 'error' | 'success'
export type LogAction = 'login' | 'logout' | 'create' | 'update' | 'delete' | 'payment' | 'suspend' | 'activate'

export interface Database {
  viralizahost: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string
          phone: string | null
          country: string
          role: UserRole
          currency: CurrencyCode
          avatar_url: string | null
          is_active: boolean
          email_verified: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['viralizahost']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['viralizahost']['Tables']['profiles']['Insert']>
      }
      clients: {
        Row: {
          id: string
          profile_id: string
          company_name: string | null
          tax_id: string | null
          address: string | null
          city: string | null
          state: string | null
          postal_code: string | null
          notes: string | null
          credit_balance: number
          currency: CurrencyCode
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['viralizahost']['Tables']['clients']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['viralizahost']['Tables']['clients']['Insert']>
      }
      plans: {
        Row: {
          id: string
          slug: string
          name: string
          type: PlanType
          description: string | null
          features: Json
          price_akz: number
          price_brl: number
          price_usd: number
          disk_gb: number
          bandwidth_gb: number
          email_accounts: number
          max_domains: number
          max_subdomains: number
          max_databases: number
          is_popular: boolean
          is_active: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['viralizahost']['Tables']['plans']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['viralizahost']['Tables']['plans']['Insert']>
      }
      servers: {
        Row: {
          id: string
          name: string
          hostname: string
          ip_address: string
          location: string
          whm_url: string | null
          whm_api_token: string | null
          whm_username: string | null
          is_active: boolean
          max_accounts: number
          current_load: number
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['viralizahost']['Tables']['servers']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['viralizahost']['Tables']['servers']['Insert']>
      }
      services: {
        Row: {
          id: string
          profile_id: string
          plan_id: string
          server_id: string | null
          status: ServiceStatus
          currency: CurrencyCode
          price: number
          billing_cycle: string
          started_at: string | null
          expires_at: string | null
          auto_renew: boolean
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['viralizahost']['Tables']['services']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['viralizahost']['Tables']['services']['Insert']>
      }
      hosting_accounts: {
        Row: {
          id: string
          service_id: string
          profile_id: string
          server_id: string | null
          cpanel_username: string
          primary_domain: string
          status: ServiceStatus
          disk_used_mb: number
          bandwidth_used_mb: number
          email_count: number
          db_count: number
          php_version: string
          ssl_enabled: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['viralizahost']['Tables']['hosting_accounts']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['viralizahost']['Tables']['hosting_accounts']['Insert']>
      }
      domains: {
        Row: {
          id: string
          profile_id: string
          service_id: string | null
          name: string
          extension: string
          full_domain: string
          status: DomainStatus
          registrar: string
          nameservers: Json
          auto_renew: boolean
          is_locked: boolean
          whois_privacy: boolean
          registered_at: string
          expires_at: string | null
          price_paid: number | null
          currency: CurrencyCode | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['viralizahost']['Tables']['domains']['Row'], 'id' | 'full_domain' | 'created_at' | 'updated_at'>
        Update: Partial<Database['viralizahost']['Tables']['domains']['Insert']>
      }
      emails: {
        Row: {
          id: string
          hosting_id: string
          profile_id: string
          email_address: string
          display_name: string | null
          quota_mb: number
          used_mb: number
          status: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['viralizahost']['Tables']['emails']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['viralizahost']['Tables']['emails']['Insert']>
      }
      tickets: {
        Row: {
          id: string
          profile_id: string
          subject: string
          status: TicketStatus
          priority: TicketPriority
          department: string
          category: string | null
          ticket_number: string | null
          domain_id: string | null
          assigned_to: string | null
          service_id: string | null
          closed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['viralizahost']['Tables']['tickets']['Row'], 'id' | 'ticket_number' | 'created_at' | 'updated_at'>
        Update: Partial<Database['viralizahost']['Tables']['tickets']['Insert']>
      }
      ticket_messages: {
        Row: {
          id: string
          ticket_id: string
          profile_id: string
          message: string
          is_staff: boolean
          is_internal: boolean
          attachments: Json
          created_at: string
        }
        Insert: Omit<Database['viralizahost']['Tables']['ticket_messages']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['viralizahost']['Tables']['ticket_messages']['Insert']>
      }
      invoices: {
        Row: {
          id: string
          invoice_number: string
          profile_id: string
          service_id: string | null
          status: InvoiceStatus
          currency: CurrencyCode
          subtotal: number
          discount: number
          tax: number
          total: number
          items: Json
          due_date: string
          paid_at: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['viralizahost']['Tables']['invoices']['Row'], 'id' | 'invoice_number' | 'created_at' | 'updated_at'>
        Update: Partial<Database['viralizahost']['Tables']['invoices']['Insert']>
      }
      payments: {
        Row: {
          id: string
          invoice_id: string
          profile_id: string
          method: PaymentMethod
          amount: number
          currency: CurrencyCode
          status: string
          gateway_ref: string | null
          gateway_data: Json | null
          paid_at: string | null
          created_at: string
        }
        Insert: Omit<Database['viralizahost']['Tables']['payments']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['viralizahost']['Tables']['payments']['Insert']>
      }
      notifications: {
        Row: {
          id: string
          profile_id: string
          type: NotificationType
          title: string
          message: string
          link: string | null
          is_read: boolean
          created_at: string
        }
        Insert: Omit<Database['viralizahost']['Tables']['notifications']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['viralizahost']['Tables']['notifications']['Insert']>
      }
      activity_logs: {
        Row: {
          id: string
          profile_id: string | null
          action: LogAction
          entity_type: string | null
          entity_id: string | null
          description: string
          ip_address: string | null
          user_agent: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: Omit<Database['viralizahost']['Tables']['activity_logs']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['viralizahost']['Tables']['activity_logs']['Insert']>
      }
      site_banners: {
        Row: {
          id: string
          position: number
          active: boolean
          bg_image: string | null
          bg_color: string | null
          accent_color: string | null
          tag: string | null
          title: string | null
          subtitle: string | null
          cta_text: string | null
          cta_href: string | null
          cta_secondary_text: string | null
          cta_secondary_href: string | null
          features: string[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          position?: number
          active?: boolean
          bg_image?: string | null
          bg_color?: string | null
          accent_color?: string | null
          tag?: string | null
          title?: string | null
          subtitle?: string | null
          cta_text?: string | null
          cta_href?: string | null
          cta_secondary_text?: string | null
          cta_secondary_href?: string | null
          features?: string[] | null
        }
        Update: {
          position?: number
          active?: boolean
          bg_image?: string | null
          bg_color?: string | null
          accent_color?: string | null
          tag?: string | null
          title?: string | null
          subtitle?: string | null
          cta_text?: string | null
          cta_href?: string | null
          cta_secondary_text?: string | null
          cta_secondary_href?: string | null
          features?: string[] | null
        }
      }
      site_domains: {
        Row: {
          id: string
          extension: string
          price_monthly: number | null
          price_annual: number | null
          currency: string
          popular: boolean
          active: boolean
          position: number
          created_at: string
        }
        Insert: {
          extension: string
          price_monthly?: number | null
          price_annual?: number | null
          currency?: string
          popular?: boolean
          active?: boolean
          position?: number
        }
        Update: {
          extension?: string
          price_monthly?: number | null
          price_annual?: number | null
          currency?: string
          popular?: boolean
          active?: boolean
          position?: number
        }
      }
      site_email_plans: {
        Row: {
          id: string
          name: string
          description: string | null
          badge: string | null
          price_monthly: number | null
          price_annual: number | null
          discount_annual: number
          features: string[] | null
          active: boolean
          featured: boolean
          position: number
          created_at: string
        }
        Insert: {
          name: string
          description?: string | null
          badge?: string | null
          price_monthly?: number | null
          price_annual?: number | null
          discount_annual?: number
          features?: string[] | null
          active?: boolean
          featured?: boolean
          position?: number
        }
        Update: {
          name?: string
          description?: string | null
          badge?: string | null
          price_monthly?: number | null
          price_annual?: number | null
          discount_annual?: number
          features?: string[] | null
          active?: boolean
          featured?: boolean
          position?: number
        }
      }
      site_team: {
        Row: {
          id: string
          is_ceo: boolean
          name: string
          role: string | null
          title: string | null
          bio: string | null
          photo_url: string | null
          flag: string | null
          country: string | null
          country_code: string | null
          specialty: string | null
          secondary_flag: string | null
          secondary_country_code: string | null
          secondary_country_name: string | null
          accent_color: string
          position: number
          active: boolean
          created_at: string
        }
        Insert: {
          is_ceo?: boolean
          name: string
          role?: string | null
          title?: string | null
          bio?: string | null
          photo_url?: string | null
          flag?: string | null
          country?: string | null
          country_code?: string | null
          specialty?: string | null
          secondary_flag?: string | null
          secondary_country_code?: string | null
          secondary_country_name?: string | null
          accent_color?: string
          position?: number
          active?: boolean
        }
        Update: {
          is_ceo?: boolean
          name?: string
          role?: string | null
          title?: string | null
          bio?: string | null
          photo_url?: string | null
          flag?: string | null
          country?: string | null
          country_code?: string | null
          specialty?: string | null
          secondary_flag?: string | null
          secondary_country_code?: string | null
          secondary_country_name?: string | null
          accent_color?: string
          position?: number
          active?: boolean
        }
      }
      site_hosting_plans: {
        Row: {
          id: string
          name: string
          description: string | null
          badge: string | null
          price_monthly: number | null
          price_annual: number | null
          discount_annual: number
          features: string[] | null
          active: boolean
          featured: boolean
          position: number
          created_at: string
        }
        Insert: {
          name: string
          description?: string | null
          badge?: string | null
          price_monthly?: number | null
          price_annual?: number | null
          discount_annual?: number
          features?: string[] | null
          active?: boolean
          featured?: boolean
          position?: number
        }
        Update: {
          name?: string
          description?: string | null
          badge?: string | null
          price_monthly?: number | null
          price_annual?: number | null
          discount_annual?: number
          features?: string[] | null
          active?: boolean
          featured?: boolean
          position?: number
        }
      }
      products: {
        Row: {
          id: string
          slug: string
          category: string
          subcategory: string | null
          name: string
          description: string | null
          badge: string | null
          popular: boolean
          active: boolean
          position: number
          price_monthly: number | null
          price_6months: number | null
          price_1year: number | null
          price_2years: number | null
          price_3years: number | null
          color: string | null
          href_override: string | null
          cta_label: string | null
          image_url: string | null
          meta: Record<string, unknown>
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['viralizahost']['Tables']['products']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['viralizahost']['Tables']['products']['Insert']>
      }
      product_features: {
        Row: {
          id: string
          product_id: string
          feature: string
          included: boolean
          position: number
        }
        Insert: Omit<Database['viralizahost']['Tables']['product_features']['Row'], 'id'>
        Update: Partial<Database['viralizahost']['Tables']['product_features']['Insert']>
      }
    }
    Views: Record<string, never>
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean }
      is_staff: { Args: Record<string, never>; Returns: boolean }
      setup_product_catalog: { Args: Record<string, never>; Returns: { success: boolean; products: number } }
      check_product_catalog: { Args: Record<string, never>; Returns: { exists: boolean; products: number; features: number } }
    }
    Enums: {
      user_role: UserRole
      currency_code: CurrencyCode
    }
  }
}
