export type Currency = 'AKZ' | 'BRL' | 'USD'

export type PlanType = 'shared' | 'vps' | 'dedicated' | 'reseller'

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed'
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical'

export type DomainStatus = 'active' | 'expired' | 'pending' | 'transferred'

export type HostingStatus = 'active' | 'suspended' | 'terminated' | 'pending'

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'cancelled'

export type UserRole = 'client' | 'admin' | 'reseller'

export interface User {
  id: string
  email: string
  full_name: string
  phone?: string
  role: UserRole
  currency: Currency
  country: string
  created_at: string
  updated_at: string
}

export interface Plan {
  id: string
  name: string
  type: PlanType
  description: string
  features: string[]
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
}

export interface Domain {
  id: string
  user_id: string
  name: string
  extension: string
  status: DomainStatus
  registered_at: string
  expires_at: string
  auto_renew: boolean
  nameservers: string[]
}

export interface Hosting {
  id: string
  user_id: string
  plan_id: string
  domain: string
  status: HostingStatus
  cpanel_username?: string
  server_ip?: string
  disk_used_gb: number
  bandwidth_used_gb: number
  created_at: string
  expires_at: string
}

export interface EmailAccount {
  id: string
  hosting_id: string
  user_id: string
  email: string
  quota_mb: number
  used_mb: number
  status: 'active' | 'suspended'
  created_at: string
}

export interface Ticket {
  id: string
  user_id: string
  subject: string
  status: TicketStatus
  priority: TicketPriority
  department: string
  created_at: string
  updated_at: string
  messages?: TicketMessage[]
}

export interface TicketMessage {
  id: string
  ticket_id: string
  user_id: string
  message: string
  is_staff: boolean
  created_at: string
}

export interface Invoice {
  id: string
  user_id: string
  amount: number
  currency: Currency
  status: PaymentStatus
  payment_method?: string
  due_date: string
  paid_at?: string
  items: InvoiceItem[]
  created_at: string
}

export interface InvoiceItem {
  description: string
  quantity: number
  unit_price: number
  total: number
}
