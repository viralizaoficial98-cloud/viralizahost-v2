export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string
          phone: string | null
          role: 'client' | 'admin' | 'reseller'
          currency: 'AKZ' | 'BRL' | 'USD'
          country: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      plans: {
        Row: {
          id: string
          name: string
          type: string
          description: string
          features: Json
          price_akz: number
          price_brl: number
          price_usd: number
          disk_gb: number
          bandwidth_gb: number
          email_accounts: number
          domains: number
          subdomains: number
          databases: number
          is_popular: boolean
          is_active: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['plans']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['plans']['Insert']>
      }
      domains: {
        Row: {
          id: string
          user_id: string
          name: string
          extension: string
          status: string
          registered_at: string
          expires_at: string
          auto_renew: boolean
          nameservers: Json
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['domains']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['domains']['Insert']>
      }
      hostings: {
        Row: {
          id: string
          user_id: string
          plan_id: string
          domain: string
          status: string
          cpanel_username: string | null
          server_ip: string | null
          disk_used_gb: number
          bandwidth_used_gb: number
          created_at: string
          expires_at: string
        }
        Insert: Omit<Database['public']['Tables']['hostings']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['hostings']['Insert']>
      }
      tickets: {
        Row: {
          id: string
          user_id: string
          subject: string
          status: string
          priority: string
          department: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['tickets']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['tickets']['Insert']>
      }
      ticket_messages: {
        Row: {
          id: string
          ticket_id: string
          user_id: string
          message: string
          is_staff: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['ticket_messages']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['ticket_messages']['Insert']>
      }
      invoices: {
        Row: {
          id: string
          user_id: string
          amount: number
          currency: string
          status: string
          payment_method: string | null
          due_date: string
          paid_at: string | null
          items: Json
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['invoices']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['invoices']['Insert']>
      }
    }
  }
}
