/**
 * TESTE — executa as ferramentas do agente de IA (src/lib/agent/tools.ts) diretamente sobre a base MySQL,
 * sem chamar o modelo, para validar as consultas que o agente faz em nome do cliente e do administrador.
 *   NEXT_PUBLIC_DATA_BACKEND=mysql MYSQL_… CLIENT_ID=… ADMIN_ID=… npx tsx scripts/mysql-migration/test/agent-tools.test.ts
 * Saída: JSON com { tool, level, ok, detail } por ferramenta.
 */
import { buildTools } from '@/lib/agent/tools'
import { getPool } from '@/lib/db/pool'

type Exec = { execute: (input: Record<string, unknown>, opts?: unknown) => Promise<unknown> }

async function main() {
  const clientId = process.env.CLIENT_ID!, adminId = process.env.ADMIN_ID!
  const [[ticket]] = await getPool().query<any[]>('SELECT id FROM tickets WHERE profile_id = ? ORDER BY ticket_number LIMIT 1', [clientId]) // eslint-disable-line @typescript-eslint/no-explicit-any
  const [[invoice]] = await getPool().query<any[]>('SELECT id FROM invoices WHERE profile_id = ? ORDER BY invoice_number LIMIT 1', [clientId]) // eslint-disable-line @typescript-eslint/no-explicit-any

  const inputs: Record<string, Record<string, unknown>> = {
    getPlans: {}, getProducts: { search: 'Plano' }, getProductCategories: {}, getDomainPrices: { extension: '.com' },
    getCompanyInfo: {}, getPaymentMethods: {}, getEmailPlans: {}, getMyProfile: {}, getMyServices: {}, getMyHosting: {},
    getCpanelAccess: {}, getMyDomains: {}, getMyEmails: {}, getMyInvoices: { limit: 5 }, getMyPayments: { limit: 5 },
    getMyTickets: {}, getTicketMessages: { ticket_id: ticket?.id }, createTicket: { subject: 'Pedido via agente — ação', message: 'Olá 🚀', priority: 'low' },
    replyToTicket: { ticket_id: ticket?.id, message: 'Resposta pelo agente' }, getMyOrders: { limit: 5 }, getInvoiceDetails: { invoice_id: invoice?.id },
    closeTicket: { ticket_id: ticket?.id, reason: 'teste' }, reopenTicket: { ticket_id: ticket?.id, message: 'reabrir' }, getPaymentInstructions: {},
    sendInvoiceToCustomer: { invoice_id: invoice?.id },
    adminSearchClient: { query: 'cliente' }, adminGetTicketStats: {}, adminGetConversations: { limit: 5 },
    adminGetClientServices: { profile_id: clientId }, adminGetFinancialSummary: {},
  }
  const out: { tool: string; level: string; ok: boolean; detail: string }[] = []
  for (const [level, profileId] of [['client', clientId], ['admin', adminId]] as const) {
    const tools = buildTools({ userLevel: level, profileId }) as Record<string, Exec>
    for (const [name, t] of Object.entries(tools)) {
      if (name === 'checkDomainAvailability') continue // consulta RDAP externa, sem base de dados
      try {
        const r = await t.execute(inputs[name] ?? {}, { toolCallId: 'x', messages: [] })
        const s = JSON.stringify(r) ?? 'undefined'
        // Erros de base de dados aparecem como "Não foi possível…"/"Erro ao…" nas respostas das ferramentas
        const dbError = /N[ãa]o foi poss[ií]vel (carregar|obter|consultar)|Erro ao (carregar|obter|consultar|criar|actualizar|atualizar|registar)|schema cache|PGRST|XX000/i.test(s)
        out.push({ tool: name, level, ok: !dbError, detail: s.slice(0, 220) })
      } catch (e) {
        out.push({ tool: name, level, ok: false, detail: String((e as Error).message) })
      }
    }
  }
  console.log(JSON.stringify(out))
  await getPool().end()
}
main().catch(e => { console.error(e); process.exit(1) })
