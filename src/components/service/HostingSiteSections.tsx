import Link from 'next/link'
import { ArrowRight, Check, DatabaseBackup, Eye, KeyRound, LayoutTemplate, Lock, MousePointerClick, ServerCog, ShieldCheck, Users, type LucideIcon } from 'lucide-react'

// Página /hospedagem-de-sites: secções «Crie e publique o seu site» e «Segurança para o seu site».
// Só afirmações confirmadas no catálogo ou na documentação interna:
//   • SSL: o texto vem do catálogo (planos de hospedagem com «SSL grátis» incluído) — ver sslCoverage na página;
//   • cópias de segurança: incluídas em todos os planos de hospedagem (frequência conforme o plano);
//   • contas cPanel separadas por cliente (WHM).
// Por confirmar (descritos de forma genérica, sem nomes de produtos): SitePad e número de modelos, Imunify360 e
// os seus recursos (firewall, malware, WAF, reputação de IP). Ver docs/hospedagem-de-sites.md.

/* ───────────── Crie e publique o seu site ───────────── */

interface Option { id: string; n: string; icon: LucideIcon; title: string; text: string; points: string[]; links: { label: string; href: string; tid: string }[] }
const OPTIONS: Option[] = [
  {
    id: 'wordpress', n: '1', icon: LayoutTemplate, title: 'Use WordPress',
    text: 'O WordPress é a plataforma mais usada para criar sites. A hospedagem está preparada para o correr com estabilidade, para que os visitantes encontrem um site rápido e com aspecto profissional.',
    points: ['Instale o WordPress a partir do cPanel', 'Temas e plugins para blogs, lojas e sites de empresa', 'Gere páginas, artigos e imagens num só painel'],
    links: [{ label: 'Ver planos WordPress', href: '#planos-wordpress', tid: 'build-link-wordpress' }],
  },
  {
    id: 'editor-visual', n: '2', icon: MousePointerClick, title: 'Crie com um editor visual',
    text: 'Monte o site sem programar: escolha uma estrutura, arraste os blocos para o sítio certo e altere textos, imagens e cores enquanto vê o resultado.',
    points: ['Edição visual, sem código', 'Páginas adaptadas a computador e telemóvel', 'Publicação direta no seu próprio domínio'],
    links: [{ label: 'Ver o criador de sites', href: '/criador-de-sites', tid: 'build-link-builder' }, { label: 'Construtor WordPress', href: '/construtor-wordpress', tid: 'build-link-wp-builder' }],
  },
  {
    id: 'site-pela-equipa', n: '3', icon: Users, title: 'Peça um site à nossa equipa',
    text: 'Prefere delegar? Conte-nos o que a sua empresa precisa e a nossa equipa prepara uma proposta para criar o site e publicá-lo na sua hospedagem.',
    points: ['Conversa inicial para perceber o seu negócio', 'Proposta clara antes de começar', 'Site entregue no seu domínio, pronto a usar'],
    links: [{ label: 'Pedir uma proposta', href: '/suporte/contactar', tid: 'build-link-team' }],
  },
]

export function BuildSiteSection() {
  return (
    <section id="crie-o-seu-site" className="scroll-mt-24 bg-white py-20" aria-labelledby="crie-title" data-testid="section-build" data-section="build">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="section-tag">Criar o site</span>
          <h2 id="crie-title" className="text-3xl md:text-4xl font-black text-[#0A0A0A] mt-3 mb-3">Crie e publique o seu site</h2>
          <p className="text-[#555] text-sm md:text-base">Escolha a forma que mais lhe convém. Qualquer uma delas funciona com a sua hospedagem e o seu domínio.</p>
        </div>
        <ol className="grid grid-cols-1 lg:grid-cols-3 gap-5 max-w-6xl mx-auto">
          {OPTIONS.map(o => (
            <li key={o.id} id={o.id} className="scroll-mt-28 relative flex flex-col rounded-2xl border border-[#ECECEC] bg-[#FCFCFA] p-6 sm:p-7 hover:border-[#F5B700] transition-colors" data-testid={`build-option-${o.id}`}>
              <div className="flex items-center gap-3 mb-4">
                <span className="w-11 h-11 rounded-xl bg-[#F5B700] text-[#0A0A0A] flex items-center justify-center shrink-0"><o.icon size={20} aria-hidden="true" /></span>
                <span className="text-xs font-black tracking-widest text-[#B98900]" aria-hidden="true">OPÇÃO {o.n}</span>
              </div>
              <h3 className="text-xl font-black text-[#0A0A0A] mb-2">{o.title}</h3>
              <p className="text-sm text-[#555] leading-relaxed mb-4">{o.text}</p>
              <ul className="space-y-2 mb-6">
                {o.points.map(p => <li key={p} className="flex gap-2 text-sm text-[#333]"><Check size={16} className="text-[#D9A300] shrink-0 mt-0.5" aria-hidden="true" />{p}</li>)}
              </ul>
              <div className="mt-auto flex flex-wrap gap-x-4 gap-y-2">
                {o.links.map((l, i) => (
                  <Link key={l.href} href={l.href} data-testid={l.tid}
                    className={i === 0 ? 'inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold bg-[#0A0A0A] text-white hover:bg-[#222]' : 'inline-flex items-center gap-1 py-2.5 text-sm font-bold text-[#0A0A0A] underline decoration-[#F5B700] decoration-2 underline-offset-4'}>
                    {l.label} <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                ))}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

/* ───────────── Segurança para o seu site ───────────── */

const PROTECTION: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: ServerCog, title: 'Servidores mantidos pela equipa', text: 'Acompanhamos e atualizamos os servidores de alojamento, com medidas de proteção contra acessos e tráfego suspeitos.' },
  { icon: KeyRound, title: 'Cada conta no seu espaço', text: 'Cada cliente tem a sua própria conta cPanel, com acesso por utilizador e palavra-passe.' },
  { icon: DatabaseBackup, title: 'Cópias de segurança', text: 'Todos os planos incluem cópias de segurança automáticas; a frequência depende do plano escolhido.' },
  { icon: Eye, title: 'Ajuda quando algo corre mal', text: 'Se notar algo estranho no site, a equipa de suporte ajuda a analisar e a repor o funcionamento.' },
]

/** Cobertura do SSL lida do catálogo: todos os planos de hospedagem, alguns, ou nenhum. */
export interface SslCoverage { all: boolean; plans: string[] }

export function SecuritySection({ ssl }: { ssl: SslCoverage }) {
  const sslNote = ssl.all ? 'Certificado SSL gratuito incluído em todos os planos de hospedagem.'
    : ssl.plans.length ? `Certificado SSL gratuito incluído nos planos ${ssl.plans.join(', ')}.` : null
  return (
    <section id="seguranca" className="scroll-mt-24 bg-[#F8F8F8] py-20" aria-labelledby="seguranca-title" data-testid="section-security" data-section="security">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="section-tag">Segurança</span>
          <h2 id="seguranca-title" className="text-3xl md:text-4xl font-black text-[#0A0A0A] mt-3 mb-3">Segurança para o seu site</h2>
          <p className="text-[#555] text-sm md:text-base">Duas camadas que se completam: a proteção do servidor onde o site está alojado e a ligação segura entre o site e quem o visita.</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 max-w-6xl mx-auto">
          <article className="lg:col-span-3 rounded-2xl bg-white border border-[#ECECEC] p-6 sm:p-8" data-testid="security-hosting" aria-labelledby="protecao-title">
            <div className="flex items-center gap-3 mb-2">
              <span className="w-11 h-11 rounded-xl bg-[#0A0A0A] text-[#F5B700] flex items-center justify-center shrink-0"><ShieldCheck size={20} aria-hidden="true" /></span>
              <h3 id="protecao-title" className="text-xl font-black text-[#0A0A0A]">Proteção do alojamento</h3>
            </div>
            <p className="text-sm text-[#555] mb-6">O que fazemos para manter o seu site e os seus dados em segurança, do lado do servidor.</p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {PROTECTION.map(p => (
                <li key={p.title} className="flex gap-3">
                  <span className="w-9 h-9 rounded-lg bg-[#FFF6D6] text-[#B98900] flex items-center justify-center shrink-0"><p.icon size={17} aria-hidden="true" /></span>
                  <span><strong className="block text-sm text-[#0A0A0A]">{p.title}</strong><span className="block text-sm text-[#555] leading-relaxed">{p.text}</span></span>
                </li>
              ))}
            </ul>
          </article>

          <article className="lg:col-span-2 rounded-2xl bg-white border border-[#ECECEC] p-6 sm:p-8 flex flex-col" data-testid="security-https" aria-labelledby="https-title">
            <div className="flex items-center gap-3 mb-2">
              <span className="w-11 h-11 rounded-xl bg-[#0A0A0A] text-[#F5B700] flex items-center justify-center shrink-0"><Lock size={20} aria-hidden="true" /></span>
              <h3 id="https-title" className="text-xl font-black text-[#0A0A0A]">HTTPS para os seus visitantes</h3>
            </div>
            {/* Barra de endereço ilustrativa */}
            <div className="my-5 rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] px-3 py-2.5 flex items-center gap-2 text-sm" aria-hidden="true">
              <Lock size={14} className="text-green-600 shrink-0" />
              <span className="text-[#777]">https://</span><span className="font-semibold text-[#0A0A0A] truncate">www.asuaempresa.ao</span>
            </div>
            <ol className="space-y-3 text-sm text-[#444]">
              <li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-[#F5B700] text-[#0A0A0A] text-xs font-black flex items-center justify-center shrink-0">1</span><span>O certificado SSL permite abrir o site com <strong>https://</strong> e o cadeado no navegador.</span></li>
              <li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-[#F5B700] text-[#0A0A0A] text-xs font-black flex items-center justify-center shrink-0">2</span><span>A informação trocada entre o navegador e o servidor — como formulários e palavras-passe — segue cifrada, o que dificulta que alguém a leia pelo caminho.</span></li>
              <li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-[#F5B700] text-[#0A0A0A] text-xs font-black flex items-center justify-center shrink-0">3</span><span>Os navegadores deixam de mostrar o aviso «Não seguro», o que transmite mais confiança a quem visita.</span></li>
            </ol>
            {sslNote && <p className="mt-6 rounded-xl bg-[#FFF6D6] border border-[#F5E3A3] px-4 py-3 text-sm font-semibold text-[#5C4A00] flex gap-2" data-testid="ssl-note"><Check size={16} className="shrink-0 mt-0.5" aria-hidden="true" />{sslNote}</p>}
            <p className="mt-3 text-xs text-[#888]">O HTTPS protege a ligação; a segurança do site depende também de manter o WordPress, os temas e os plugins atualizados.</p>
          </article>
        </div>
      </div>
    </section>
  )
}
