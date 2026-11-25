import { ClipboardCheck, CreditCard, FileSearch, KeyRound, LayoutDashboard, Server, ShieldCheck, Users } from 'lucide-react'

// Secções informativas da página /revenda-de-hospedagem (servidor): comparação, como funciona, WHM/cPanel e FAQ.
// Os valores da comparação vêm do catálogo e do perfil técnico de cada plano (nunca fixos no código).

export interface ComparePlan { slug: string; name: string; highlight: boolean; monthly: number | null; storageMb: number | null; bandwidthMb: number | null; accounts: number | null }
const gb = (mb: number | null) => (mb == null ? '—' : `${Math.round(mb / 1024).toLocaleString('pt-PT')} GB`)
const kz = (v: number | null) => (v == null ? 'Sob consulta' : `${Math.round(v).toLocaleString('pt-PT').replace(/\s/g, '.')} Kz/mês`)

export function ResellerComparison({ plans }: { plans: ComparePlan[] }) {
  if (plans.length < 2) return null
  const rows: [string, (p: ComparePlan) => string][] = [
    ['Preço (mensal)', p => kz(p.monthly)],
    ['Armazenamento para clientes', p => gb(p.storageMb)],
    ['Contas cPanel para clientes', p => (p.accounts == null ? '—' : String(p.accounts))],
    ['Tráfego mensal', p => gb(p.bandwidthMb)],
    ['Painel WHM de revendedor', () => '✓'],
    ['cPanel em cada conta', () => '✓'],
    ['SSL gratuito', () => '✓'],
    ['Overselling', () => 'Não (recursos garantidos)'],
  ]
  return (
    <section className="bg-white py-20" data-testid="reseller-compare">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="text-center mb-10">
          <span className="section-tag">Comparação</span>
          <h2 className="text-3xl md:text-4xl font-black text-[#0A0A0A] mt-3">Compare os planos de revenda</h2>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-[#E8E8E8]">
          <table className="w-full text-sm min-w-[560px]">
            <thead><tr className="bg-[#0A0A0A] text-white">
              <th className="text-left px-4 py-3 font-semibold">Recurso</th>
              {plans.map(p => <th key={p.slug} className={`px-4 py-3 font-bold ${p.highlight ? 'text-[#F5B700]' : ''}`}>{p.name}</th>)}
            </tr></thead>
            <tbody>
              {rows.map(([label, fn], i) => (
                <tr key={label} className={i % 2 ? 'bg-[#FAFAFA]' : 'bg-white'}>
                  <td className="px-4 py-3 text-[#444] font-medium">{label}</td>
                  {plans.map(p => <td key={p.slug} className="px-4 py-3 text-center text-[#0A0A0A]" data-testid={`cmp-${p.slug}`}>{fn(p)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

const STEPS = [
  { icon: ClipboardCheck, title: '1. Pedido', desc: 'Escolha o plano e o ciclo e envie o pedido. Não paga nada nesta fase.' },
  { icon: FileSearch, title: '2. Análise técnica', desc: 'A equipa confirma a capacidade do servidor e os dados do pedido.' },
  { icon: CreditCard, title: '3. Factura e pagamento', desc: 'Depois da aprovação recebe a factura. A activação começa com o pagamento confirmado.' },
  { icon: LayoutDashboard, title: '4. Activação', desc: 'Criamos o seu revendedor no WHM com limites garantidos e enviamos o acesso pela área de cliente.' },
]
export function ResellerHowItWorks() {
  return (
    <section className="bg-[#F8F8F8] py-20" data-testid="reseller-how">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="text-center mb-12">
          <span className="section-tag">Como funciona</span>
          <h2 className="text-3xl md:text-4xl font-black text-[#0A0A0A] mt-3 mb-3">Da candidatura ao seu painel WHM</h2>
          <p className="text-[#666] max-w-2xl mx-auto text-sm md:text-base">A revenda é contratada com aprovação: cada revendedor recebe recursos reais, sem overselling, num servidor com capacidade confirmada.</p>
        </div>
        <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {STEPS.map(({ icon: I, title, desc }) => (
            <li key={title} className="bg-white rounded-2xl border border-[#E8E8E8] p-6">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: 'rgba(245,183,0,0.12)' }}><I size={20} className="text-[#F5B700]" /></div>
              <p className="font-bold text-[#0A0A0A]">{title}</p>
              <p className="text-sm text-[#666] mt-1">{desc}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

export function ResellerWhmInfo() {
  const items = [
    { icon: Server, title: 'WHM de revendedor', desc: 'Crie, suspenda e gira as contas cPanel dos seus clientes dentro dos limites do plano.' },
    { icon: Users, title: 'cPanel para cada cliente', desc: 'Cada cliente recebe o seu cPanel: e-mail, bases de dados, ficheiros, SSL e DNS.' },
    { icon: ShieldCheck, title: 'Isolamento e limites garantidos', desc: 'Sem overselling: o espaço e as contas do seu plano estão reservados para si.' },
    { icon: KeyRound, title: 'Acesso seguro', desc: 'Entrada no WHM e no cPanel por sessão temporária a partir da área de cliente — sem partilhar senhas.' },
  ]
  return (
    <section className="bg-[#0A0A0A] py-20" data-testid="reseller-whm-info">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="text-center mb-12">
          <span className="section-tag !bg-yellow-400/10 !text-yellow-400 !border-yellow-400/20">WHM / cPanel</span>
          <h2 className="text-3xl md:text-4xl font-black text-white mt-3">O que recebe como revendedor</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {items.map(({ icon: I, title, desc }) => (
            <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <I size={22} className="text-[#F5B700]" />
              <p className="font-bold text-white mt-3">{title}</p>
              <p className="text-sm text-gray-400 mt-1">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

const FAQ = [
  ['Porque é que a revenda precisa de aprovação?', 'Para garantir que cada revendedor tem os recursos que contratou. Antes de activar, a equipa confirma a capacidade do servidor e a licença cPanel — sem overselling.'],
  ['Pago alguma coisa ao enviar o pedido?', 'Não. Só recebe a factura depois da aprovação técnica. A activação começa quando o pagamento é confirmado.'],
  ['Quanto tempo demora a activação?', 'Depois do pagamento confirmado, a equipa autoriza e acompanha a activação do seu revendedor. Recebe um aviso por e-mail e na área de cliente assim que o painel estiver pronto.'],
  ['Posso usar a minha marca?', 'Sim. Os seus clientes vêem o cPanel com o domínio deles; os nameservers podem usar a sua marca (DNS whitelabel).'],
  ['Posso mudar de plano?', 'Sim. Na área de cliente → Revenda use «Solicitar upgrade»; a equipa confirma a capacidade e emite a diferença.'],
  ['O que acontece se exceder os limites?', 'O WHM não permite criar contas além do limite do plano nem distribuir mais espaço do que o contratado. Pode pedir upgrade a qualquer momento.'],
]
export function ResellerFaq() {
  return (
    <section className="bg-white py-20" data-testid="reseller-faq">
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="text-center mb-10">
          <span className="section-tag">Perguntas frequentes</span>
          <h2 className="text-3xl md:text-4xl font-black text-[#0A0A0A] mt-3">Dúvidas sobre a revenda</h2>
        </div>
        <div className="space-y-3">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group rounded-2xl border border-[#E8E8E8] bg-[#FAFAFA] px-5 py-4" data-testid="reseller-faq-item">
              <summary className="cursor-pointer list-none font-bold text-[#0A0A0A] flex justify-between gap-3">{q}<span className="text-[#F5B700] group-open:rotate-45 transition-transform">+</span></summary>
              <p className="text-sm text-[#555] mt-3">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
