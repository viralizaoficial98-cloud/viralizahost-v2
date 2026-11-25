'use client'
import { useEffect, useState } from 'react'
import { Badge, card, cvApi, d10, ErrorBox, Kpi, kz, money, Spinner } from './ui'

// Custos e rentabilidade: por serviço (venda, custo, margem, próxima cobrança ao cliente e do fornecedor).
/* eslint-disable @typescript-eslint/no-explicit-any */
export function CostsSection() {
  const [d, setD] = useState<any>(null), [o, setO] = useState<any>(null), [err, setErr] = useState('')
  useEffect(() => { Promise.all([cvApi('finance'), cvApi('overview')]).then(([f, ov]) => { setD(f); setO(ov) }).catch(e => setErr(e.message)) }, [])
  if (err) return <ErrorBox msg={err} />
  if (!d || !o) return <Spinner />
  const neg = d.services.filter((s: any) => s.margin != null && s.margin < 0).length
  return (
    <div className="space-y-4" data-testid="cv-costs">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Facturação mensal (equivalente)" value={kz(o.money.monthlyBilling)} />
        <Kpi label="Custos do fornecedor / mês" value={o.money.fxConfigured ? kz(o.money.providerMonthly) : '—'} hint={o.money.fxConfigured ? undefined : 'Defina o câmbio'} />
        <Kpi label="Margem bruta / mês" value={o.money.fxConfigured ? kz(o.money.grossMargin) : '—'} tone={o.money.grossMargin < 0 ? 'red' : 'green'} />
        <Kpi label="Serviços com margem negativa" value={neg} tone={neg ? 'red' : undefined} testId="cv-neg-margin" />
      </div>
      {!d.finance.fxBrlAoa && <p className="text-xs bg-amber-50 border border-amber-200 rounded-xl p-3">Sem câmbio BRL→AOA: custos em Kz e margens não podem ser calculados (Configurações → Finanças).</p>}
      <div className={`${card} overflow-x-auto`}>
        <table className="w-full text-xs min-w-[900px]">
          <thead><tr className="text-left text-[#64748B] uppercase"><th className="p-3">Serviço</th><th>Estado</th><th>Venda</th><th>Custo (compra)</th><th>Margem</th><th>Renovação venda / custo</th><th>Margem renovação</th><th>Próx. cobrança cliente</th><th>Próx. cobrança fornecedor</th></tr></thead>
          <tbody>{d.services.length === 0 ? <tr><td className="p-3" colSpan={9}>Sem serviços VPS activos.</td></tr> : d.services.map((s: any) => (
            <tr key={s.id} className="border-t border-[#F1F5F9]" data-testid="cv-cost-row">
              <td className="p-3">{s.service_name}<br /><span className="text-[#94A3B8]">{s.email}{s.provider_vm_id ? ` · VM ${s.provider_vm_id}` : ''}</span></td>
              <td><Badge tone={s.status === 'active' ? 'green' : 'amber'}>{s.status}</Badge></td>
              <td>{kz(s.price)} / {s.months} m</td>
              <td>{money(s.expected_cost_minor, s.currency)}{s.costKz != null && <><br /><span className="text-[#94A3B8]">{kz(s.costKz)}</span></>}</td>
              <td className={s.margin < 0 ? 'text-red-700 font-bold' : ''}>{kz(s.margin)}</td>
              <td>{kz(s.renewal_price)} / {money(s.sub_renewal_minor, s.sub_currency)}</td>
              <td className={s.marginRenewal < 0 ? 'text-red-700 font-bold' : ''}>{kz(s.marginRenewal)}</td>
              <td>{d10(s.next_due_date)}</td>
              <td>{d10(s.sub_next_billing_at)}{s.sub_auto_renew != null && <><br /><span className="text-[#94A3B8]">auto-renovação {Number(s.sub_auto_renew) ? 'sim' : 'não'}</span></>}</td>
            </tr>))}</tbody>
        </table>
      </div>
      <p className="text-xs text-[#64748B]">Cancelamento comercial (cliente deixa de pagar), suspensão técnica (VPS parado) e desactivação da renovação do fornecedor (subscrição Hostinger) são coisas diferentes: o portal não cancela subscrições automaticamente.</p>
    </div>
  )
}
