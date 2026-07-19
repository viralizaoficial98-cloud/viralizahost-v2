import React from 'react'
import { Metadata } from 'next'
import { Mail, CheckCircle2, AlertCircle, Clock, RefreshCw, FileText, Package, XCircle } from 'lucide-react'
import { requireAdminRole } from '@/lib/api/require-admin'
import { createAdminWriteClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const metadata: Metadata = { title: 'Logs de E-mail — Admin ViralizaHost' }

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string; icon: React.ReactNode }> = {
  sent:       { bg: '#ECFDF5', color: '#059669', label: 'Enviado',    icon: <CheckCircle2 size={12} /> },
  delivered:  { bg: '#ECFDF5', color: '#059669', label: 'Entregue',   icon: <CheckCircle2 size={12} /> },
  queued:     { bg: '#EFF6FF', color: '#3B82F6', label: 'Na fila',    icon: <Clock size={12} /> },
  processing: { bg: '#EFF6FF', color: '#3B82F6', label: 'A enviar',   icon: <RefreshCw size={12} /> },
  delayed:    { bg: '#FFF7ED', color: '#EA580C', label: 'Atrasado',   icon: <Clock size={12} /> },
  bounced:    { bg: '#FEF2F2', color: '#DC2626', label: 'Rejeitado',  icon: <XCircle size={12} /> },
  failed:     { bg: '#FEF2F2', color: '#DC2626', label: 'Falhou',     icon: <AlertCircle size={12} /> },
  complained: { bg: '#FEF2F2', color: '#9333EA', label: 'Spam',       icon: <AlertCircle size={12} /> },
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? { bg: '#F3F4F6', color: '#6B7280', label: status, icon: null }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: s.bg, color: s.color, padding: '3px 10px',
      borderRadius: 20, fontSize: 11, fontWeight: 700,
    }}>
      {s.icon}{s.label}
    </span>
  )
}

export default async function AdminEmailLogsPage() {
  const session = await requireAdminRole().catch(() => null)
  if (!session) redirect('/login')

  const db = createAdminWriteClient()

  const { data: logs } = await db
    .from('email_logs')
    .select(`
      id, recipient, sender, subject, provider, provider_message_id,
      status, error_message, attempts, initiated_by_agent,
      sent_at, delivered_at, failed_at, created_at,
      profile:profiles(full_name, email),
      invoice:invoices(invoice_number, total, currency),
      order:orders(id, amount, billing_cycle)
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  const stats = {
    total:     logs?.length ?? 0,
    sent:      logs?.filter(l => l.status === 'sent' || l.status === 'delivered').length ?? 0,
    failed:    logs?.filter(l => l.status === 'failed' || l.status === 'bounced').length ?? 0,
    pending:   logs?.filter(l => l.status === 'queued' || l.status === 'processing').length ?? 0,
  }

  const card: React.CSSProperties = {
    background: '#FFFFFF', border: '1px solid #E5E7EB',
    borderRadius: 16, overflow: 'hidden',
    boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
  }

  const th: React.CSSProperties = {
    padding: '10px 16px', textAlign: 'left', fontSize: 11,
    fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase',
    letterSpacing: '0.05em', background: '#F8FAFC',
    borderBottom: '1px solid #F1F5F9', whiteSpace: 'nowrap',
  }

  const td: React.CSSProperties = {
    padding: '12px 16px', fontSize: 13, color: '#1E293B',
    borderBottom: '1px solid #F8FAFC', verticalAlign: 'top',
  }

  return (
    <div style={{ padding: '32px 28px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <div style={{ width: 44, height: 44, background: '#0A0A0A', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Mail size={22} color="#F5B700" />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0A0A0A', margin: 0 }}>Logs de E-mail</h1>
          <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>Histórico completo de envios de faturas e notificações</p>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'Total', value: stats.total, color: '#6366F1', icon: <Mail size={18} /> },
          { label: 'Enviados', value: stats.sent, color: '#059669', icon: <CheckCircle2 size={18} /> },
          { label: 'Falhados', value: stats.failed, color: '#DC2626', icon: <AlertCircle size={18} /> },
          { label: 'Pendentes', value: stats.pending, color: '#EA580C', icon: <Clock size={18} /> },
        ].map(s => (
          <div key={s.label} style={{ ...card, padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ color: s.color }}>{s.icon}</span>
              <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>{s.label}</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={card}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Mail size={16} color="#F5B700" />
          <span style={{ fontWeight: 700, fontSize: 14 }}>Últimos 100 registos</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={th}>Destinatário</th>
                <th style={th}>Assunto</th>
                <th style={th}>Cliente</th>
                <th style={th}>Fatura</th>
                <th style={th}>Estado</th>
                <th style={th}>Provider ID</th>
                <th style={th}>Tentativas</th>
                <th style={th}>Data</th>
                <th style={th}>Erro</th>
                <th style={th}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {!logs?.length && (
                <tr>
                  <td colSpan={10} style={{ ...td, textAlign: 'center', color: '#94A3B8', padding: '40px' }}>
                    Nenhum log encontrado.
                  </td>
                </tr>
              )}
              {logs?.map(log => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const profile = log.profile as any
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const invoice = log.invoice as any
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const order   = log.order as any
                const isFailed = log.status === 'failed' || log.status === 'bounced'

                return (
                  <tr key={log.id} style={{ background: isFailed ? '#FFF5F5' : 'transparent' }}>
                    <td style={td}>
                      <div style={{ fontWeight: 600, color: '#0A0A0A' }}>{log.recipient}</div>
                      {log.initiated_by_agent && (
                        <span style={{ fontSize: 10, background: '#EFF6FF', color: '#3B82F6', padding: '2px 6px', borderRadius: 4 }}>via IA</span>
                      )}
                    </td>
                    <td style={{ ...td, maxWidth: 220 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#475569' }}>
                        {log.subject ?? '—'}
                      </div>
                    </td>
                    <td style={td}>
                      {profile ? (
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 12 }}>{profile.full_name ?? '—'}</div>
                          <div style={{ color: '#94A3B8', fontSize: 11 }}>{profile.email ?? ''}</div>
                        </div>
                      ) : '—'}
                    </td>
                    <td style={td}>
                      {invoice ? (
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 12 }}>{invoice.invoice_number}</div>
                          <div style={{ color: '#059669', fontSize: 11 }}>{invoice.currency} {Number(invoice.total).toLocaleString('pt-PT', { minimumFractionDigits: 2 })}</div>
                        </div>
                      ) : order ? (
                        <div style={{ fontSize: 11, color: '#94A3B8' }}>Pedido #{String(order.id).slice(0, 8).toUpperCase()}</div>
                      ) : '—'}
                    </td>
                    <td style={td}>
                      <StatusBadge status={log.status} />
                    </td>
                    <td style={td}>
                      {log.provider_message_id ? (
                        <code style={{ fontSize: 10, background: '#F1F5F9', padding: '2px 6px', borderRadius: 4, color: '#475569' }}>
                          {log.provider_message_id.slice(0, 16)}...
                        </code>
                      ) : '—'}
                    </td>
                    <td style={{ ...td, textAlign: 'center' }}>
                      <span style={{ fontWeight: 700, color: log.attempts > 1 ? '#EA580C' : '#0A0A0A' }}>{log.attempts}</span>
                    </td>
                    <td style={td}>
                      <div style={{ fontSize: 11, color: '#64748B', whiteSpace: 'nowrap' }}>
                        {fmtDate(log.sent_at ?? log.created_at)}
                        {log.delivered_at && <div style={{ color: '#059669' }}>✓ {fmtDate(log.delivered_at)}</div>}
                        {log.failed_at    && <div style={{ color: '#DC2626' }}>✗ {fmtDate(log.failed_at)}</div>}
                      </div>
                    </td>
                    <td style={{ ...td, maxWidth: 200 }}>
                      {log.error_message ? (
                        <div style={{ fontSize: 11, color: '#DC2626', background: '#FEF2F2', padding: '4px 8px', borderRadius: 4, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.error_message}>
                          {log.error_message}
                        </div>
                      ) : '—'}
                    </td>
                    <td style={td}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {invoice && (
                          <a
                            href={`/admin/financial?invoice=${invoice.invoice_number}`}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '4px 10px', borderRadius: 6, color: '#475569', textDecoration: 'none', fontWeight: 600 }}
                          >
                            <FileText size={10} />Ver fatura
                          </a>
                        )}
                        {order && (
                          <a
                            href={`/admin/orders?id=${order.id}`}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '4px 10px', borderRadius: 6, color: '#475569', textDecoration: 'none', fontWeight: 600 }}
                          >
                            <Package size={10} />Ver pedido
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: '#94A3B8' }}>
        Esta página actualiza-se automaticamente ao recarregar. Webhook Resend: <code style={{ background: '#F1F5F9', padding: '2px 6px', borderRadius: 4 }}>/api/webhooks/resend</code>
      </p>
    </div>
  )
}
