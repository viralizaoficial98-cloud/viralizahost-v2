import { tool } from 'ai'
import { z } from 'zod'
import { createAdminWriteClient } from '@/lib/supabase/server'
import type { UserLevel } from './system-prompt'

export interface AgentContext {
  userLevel: UserLevel
  profileId?: string
}

export function buildTools(ctx: AgentContext) {
  const db = createAdminWriteClient()

  // ── Public tools (all levels) ─────────────────────────────────

  const getPlans = tool({
    description: 'Lista os planos de hospedagem disponíveis com preços e características.',
    inputSchema: z.object({
      type: z.enum(['shared', 'vps', 'dedicated', 'reseller', 'all']).optional(),
    }),
    execute: async (input) => {
      const type = input.type ?? 'all'
      let query = db.from('plans').select('id, slug, name, type, price_akz, price_brl, price_usd, disk_gb, bandwidth_gb')
      if (type !== 'all') query = query.eq('type', type)
      const { data, error } = await query.order('price_akz', { ascending: true })
      if (error) return { error: 'Não foi possível carregar os planos.' }
      return { plans: data }
    },
  })

  const getProducts = tool({
    description: 'Pesquisa produtos no catálogo (domínios, e-mail, hospedagem, etc.).',
    inputSchema: z.object({
      category: z.string().optional().describe('Categoria: hosting, email, domain, ssl, etc.'),
      search: z.string().optional().describe('Termo de pesquisa pelo nome do produto'),
    }),
    execute: async ({ category, search }) => {
      let query = db.from('products').select('id, slug, name, category, subcategory, price_monthly, price_6m, price_1y, meta')
      if (category) query = query.eq('category', category)
      if (search) query = query.ilike('name', `%${search}%`)
      const { data, error } = await query.limit(10)
      if (error) return { error: 'Não foi possível pesquisar produtos.' }
      return { products: data }
    },
  })

  const checkDomainAvailability = tool({
    description: 'Verifica se um domínio está disponível para registo e mostra o preço.',
    inputSchema: z.object({
      domain: z.string().describe('Nome do domínio a verificar, ex: meusite.ao'),
    }),
    execute: async ({ domain }) => {
      const ext = domain.split('.').slice(1).join('.')
      const { data: pricing } = await db
        .from('site_domains')
        .select('extension, price_monthly, price_annual')
        .eq('extension', ext)
        .single()

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL}/api/checkout/domain-check?domain=${encodeURIComponent(domain)}`,
        { cache: 'no-store' }
      ).catch(() => null)

      const availability = res?.ok ? await res.json().catch(() => null) : null

      return {
        domain,
        extension: ext,
        pricing: pricing ?? null,
        availability: availability ?? { checked: false, message: 'Verificação não disponível de momento.' },
      }
    },
  })

  // ── Client tools (requires auth) ──────────────────────────────

  const getMyServices = tool({
    description: 'Lista os serviços de hospedagem activos do cliente autenticado.',
    inputSchema: z.object({}),
    execute: async () => {
      if (!ctx.profileId) return { error: 'Autenticação necessária.' }
      const { data, error } = await db
        .from('services')
        .select('id, status, billing_cycle, price, currency, expires_at, plan:plans(name, type), hosting_accounts(primary_domain, cpanel_username, status, disk_used_mb)')
        .eq('profile_id', ctx.profileId)
        .order('created_at', { ascending: false })
      if (error) return { error: 'Não foi possível carregar os seus serviços.' }
      return { services: data }
    },
  })

  const getMyInvoices = tool({
    description: 'Lista as facturas do cliente, com estado de pagamento.',
    inputSchema: z.object({
      status: z.enum(['pending', 'paid', 'overdue', 'cancelled', 'all']).optional(),
      limit: z.number().min(1).max(20).optional(),
    }),
    execute: async (input) => {
      if (!ctx.profileId) return { error: 'Autenticação necessária.' }
      const status = input.status ?? 'all'
      const limit = input.limit ?? 5
      let query = db
        .from('invoices')
        .select('id, invoice_number, status, currency, total, due_date, created_at')
        .eq('profile_id', ctx.profileId)
        .order('created_at', { ascending: false })
        .limit(limit)
      if (status !== 'all') query = query.eq('status', status)
      const { data, error } = await query
      if (error) return { error: 'Não foi possível carregar as facturas.' }
      return { invoices: data }
    },
  })

  const getMyTickets = tool({
    description: 'Lista os tickets de suporte do cliente.',
    inputSchema: z.object({
      status: z.enum(['open', 'in_progress', 'resolved', 'closed', 'all']).optional(),
    }),
    execute: async (input) => {
      if (!ctx.profileId) return { error: 'Autenticação necessária.' }
      const status = input.status ?? 'all'
      let query = db
        .from('tickets')
        .select('id, subject, status, priority, department, created_at, updated_at')
        .eq('profile_id', ctx.profileId)
        .order('created_at', { ascending: false })
        .limit(10)
      if (status !== 'all') query = query.eq('status', status)
      const { data, error } = await query
      if (error) return { error: 'Não foi possível carregar os tickets.' }
      return { tickets: data }
    },
  })

  const createTicket = tool({
    description: 'Cria um ticket de suporte em nome do cliente autenticado.',
    inputSchema: z.object({
      subject: z.string().min(5).max(200).describe('Assunto do ticket'),
      message: z.string().min(10).describe('Descrição detalhada do problema'),
      department: z.enum(['suporte', 'financeiro', 'comercial', 'tecnico']).optional(),
      priority: z.enum(['low', 'medium', 'high']).optional(),
    }),
    execute: async ({ subject, message, department, priority }) => {
      if (!ctx.profileId || ctx.userLevel === 'visitor') return { error: 'Autenticação necessária para criar ticket.' }

      const { data: ticket, error: tErr } = await db
        .from('tickets')
        .insert({
          profile_id: ctx.profileId,
          subject,
          status: 'open',
          priority: priority ?? 'medium',
          department: department ?? 'suporte',
          category: 'geral',
        })
        .select('id, subject, status')
        .single()

      if (tErr || !ticket) return { error: 'Erro ao criar ticket.' }

      await db.from('ticket_messages').insert({
        ticket_id: ticket.id,
        profile_id: ctx.profileId,
        message,
        is_staff: false,
        is_internal: false,
      })

      return {
        success: true,
        ticket_id: ticket.id,
        subject: ticket.subject,
        message: `Ticket criado com sucesso. Referência: #${ticket.id.slice(0, 8).toUpperCase()}`,
      }
    },
  })

  const getMyDomains = tool({
    description: 'Lista os domínios registados pelo cliente.',
    inputSchema: z.object({}),
    execute: async () => {
      if (!ctx.profileId) return { error: 'Autenticação necessária.' }
      const { data, error } = await db
        .from('domains')
        .select('id, full_domain, status, expires_at, registrar')
        .eq('profile_id', ctx.profileId)
        .order('expires_at', { ascending: true })
      if (error) return { error: 'Não foi possível carregar os domínios.' }
      return { domains: data }
    },
  })

  const getCpanelLink = tool({
    description: 'Fornece instruções para aceder ao cPanel de um serviço do cliente.',
    inputSchema: z.object({
      service_id: z.string().uuid().describe('ID do serviço para o qual gerar o acesso cPanel'),
    }),
    execute: async ({ service_id }) => {
      if (!ctx.profileId) return { error: 'Autenticação necessária.' }

      const { data: hosting } = await db
        .from('hosting_accounts')
        .select('id, primary_domain, cpanel_username, service_id')
        .eq('service_id', service_id)
        .eq('profile_id', ctx.profileId)
        .single()

      if (!hosting) return { error: 'Serviço não encontrado ou sem permissão.' }

      return {
        note: `Para aceder ao cPanel do domínio "${hosting.primary_domain}", aceda ao painel do cliente em https://viralizahost.com/portal e clique em "Aceder ao cPanel".`,
        cpanel_username: hosting.cpanel_username,
        primary_domain: hosting.primary_domain,
      }
    },
  })

  // ── Admin tools ───────────────────────────────────────────────

  const searchClient = tool({
    description: '[Admin] Procura um cliente por nome ou e-mail.',
    inputSchema: z.object({
      query: z.string().min(2).describe('Nome ou e-mail a pesquisar'),
    }),
    execute: async ({ query }) => {
      if (ctx.userLevel !== 'admin') return { error: 'Acesso negado.' }
      const { data, error } = await db
        .from('profiles')
        .select('id, full_name, email, role, is_active, created_at')
        .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(5)
      if (error) return { error: 'Erro na pesquisa.' }
      return { clients: data }
    },
  })

  const getTicketStats = tool({
    description: '[Admin] Retorna estatísticas gerais dos tickets de suporte.',
    inputSchema: z.object({}),
    execute: async () => {
      if (ctx.userLevel !== 'admin') return { error: 'Acesso negado.' }
      const { data, error } = await db.from('tickets').select('status, priority')
      if (error) return { error: 'Erro ao carregar estatísticas.' }

      return {
        stats: {
          total: data.length,
          open: data.filter(t => t.status === 'open').length,
          in_progress: data.filter(t => t.status === 'in_progress').length,
          resolved: data.filter(t => t.status === 'resolved').length,
          critical: data.filter(t => t.priority === 'critical').length,
        },
      }
    },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allTools: Record<string, any> = {
    getPlans,
    getProducts,
    checkDomainAvailability,
  }

  if (ctx.userLevel === 'client' || ctx.userLevel === 'admin') {
    Object.assign(allTools, {
      getMyServices,
      getMyInvoices,
      getMyTickets,
      createTicket,
      getMyDomains,
      getCpanelLink,
    })
  }

  if (ctx.userLevel === 'admin') {
    Object.assign(allTools, {
      searchClient,
      getTicketStats,
    })
  }

  return allTools
}
