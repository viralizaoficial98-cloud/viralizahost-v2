import 'server-only'
import { promises as dnsp } from 'node:dns'

// Resolvedores PÚBLICOS: num servidor cPanel, o DNS local pode responder com a zona do próprio
// cPanel (o domínio parece ter MX) quando o resto da Internet — e o Resend — vê NXDOMAIN.
// EMAIL_DNS_SERVERS permite outros resolvedores (separados por vírgulas).
const dns = new dnsp.Resolver({ timeout: 4000, tries: 2 })
export const publicResolver = () => dns
dns.setServers((process.env.EMAIL_DNS_SERVERS || '8.8.8.8,1.1.1.1').split(',').map(x => x.trim()).filter(Boolean))

// O domínio do destinatário recebe correio da Internet (visto por resolvedores públicos)? (MX, ou A/AAAA como MX implícito)
// Um domínio inexistente no DNS público (NXDOMAIN) nunca recebe mensagens do Resend,
// mesmo que exista uma caixa local no nosso cPanel. Erros temporários de DNS → «unknown»
// (não bloqueiam o envio).
// EMAIL_DNS_CHECK: 'off' desliga; 'test' (só ensaio) simula: domínios com «semmx» → inexistentes.

export type MailDomainCheck =
  | { deliverable: true; mx: string[] }
  | { deliverable: false; reason: 'nxdomain' | 'no_mail_records'; message: string }
  | { deliverable: 'unknown'; message: string }

let resolverOk: { ok: boolean; at: number } | null = null
/** O resolvedor do servidor funciona? (evita confundir uma falha local de DNS com «domínio inexistente») */
async function resolverWorks(): Promise<boolean> {
  if (resolverOk && Date.now() - resolverOk.at < 5 * 60_000) return resolverOk.ok
  const control = process.env.EMAIL_DNS_CONTROL || 'gmail.com'
  const ok = await withTimeout(dns.resolveMx(control), 5000).then(r => r.length > 0).catch(() => false)
  resolverOk = { ok, at: Date.now() }
  return ok
}

const withTimeout = <T>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(Object.assign(new Error('timeout'), { code: 'ETIMEOUT' })), ms))])

export async function checkMailDomain(email: string): Promise<MailDomainCheck> {
  const domain = String(email).split('@')[1]?.trim().toLowerCase() ?? ''
  const mode = process.env.EMAIL_DNS_CHECK ?? 'on'
  if (!domain) return { deliverable: false, reason: 'nxdomain', message: 'Endereço sem domínio.' }
  if (mode === 'off') return { deliverable: 'unknown', message: 'Verificação de DNS desligada.' }
  if (mode === 'test') {
    return domain.includes('semmx')
      ? { deliverable: false, reason: 'nxdomain', message: `O domínio ${domain} não existe no DNS público.` }
      : { deliverable: true, mx: [`mx.${domain}`] }
  }
  try {
    const mx = await withTimeout(dns.resolveMx(domain), 5000)
    const hosts = mx.filter(r => r.exchange && r.exchange !== '.').sort((a, b) => a.priority - b.priority).map(r => r.exchange)
    if (hosts.length) return { deliverable: true, mx: hosts }
    return { deliverable: false, reason: 'no_mail_records', message: `O domínio ${domain} declara que não recebe correio (MX nulo).` }
  } catch (e) {
    const code = (e as { code?: string }).code
    if ((code === 'ENOTFOUND' || code === 'ENODATA') && !(await resolverWorks())) {
      return { deliverable: 'unknown', message: `O DNS do servidor não respondeu a um domínio de controlo: não foi possível confirmar ${domain}.` }
    }
    if (code === 'ENOTFOUND') return { deliverable: false, reason: 'nxdomain', message: `O domínio ${domain} não existe no DNS público (não registado, expirado ou sem delegação).` }
    if (code === 'ENODATA') {
      // Sem MX: o correio usa o registo A/AAAA (MX implícito)
      const a = await withTimeout(dns.resolve4(domain), 5000).catch(() => [] as string[])
      const aaaa = a.length ? [] : await withTimeout(dns.resolve6(domain), 5000).catch(() => [] as string[])
      if (a.length || aaaa.length) return { deliverable: true, mx: [domain] }
      return { deliverable: false, reason: 'no_mail_records', message: `O domínio ${domain} não tem registos MX nem A: não recebe correio da Internet.` }
    }
    return { deliverable: 'unknown', message: `Não foi possível consultar o DNS de ${domain} (${code ?? 'erro'}).` }
  }
}
