import React from 'react'
import {
  Document, Page, Text, View, StyleSheet, Font,
} from '@react-pdf/renderer'

Font.register({
  family: 'Helvetica',
  fonts: [],
})

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#1A1A1A',
    backgroundColor: '#FFFFFF',
    paddingTop: 40,
    paddingBottom: 50,
    paddingHorizontal: 48,
  },
  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 },
  companyBlock: { flex: 1 },
  companyName: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#0A0A0A', marginBottom: 2 },
  companyTagline: { fontSize: 8, color: '#666', marginBottom: 6 },
  companyInfo: { fontSize: 8, color: '#555', lineHeight: 1.5 },
  invoiceBlock: { alignItems: 'flex-end' },
  invoiceTitle: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: '#F5B700', letterSpacing: 1 },
  invoiceNumber: { fontSize: 10, color: '#333', marginTop: 2 },
  // Status badge
  statusBadge: { marginTop: 8, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 4, alignSelf: 'flex-start' },
  // Divider
  divider: { borderBottomWidth: 1, borderBottomColor: '#E8E8E8', marginVertical: 20 },
  yellowLine: { height: 3, backgroundColor: '#F5B700', marginBottom: 24 },
  // Billing section
  billingRow: { flexDirection: 'row', marginBottom: 20, gap: 24 },
  billingBlock: { flex: 1 },
  billingLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#F5B700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  billingValue: { fontSize: 9, color: '#1A1A1A', lineHeight: 1.6 },
  // Dates row
  datesRow: { flexDirection: 'row', gap: 24, marginBottom: 24 },
  dateBlock: { flex: 1, borderLeftWidth: 2, borderLeftColor: '#F5B700', paddingLeft: 8 },
  dateLabel: { fontSize: 7, color: '#888', marginBottom: 2 },
  dateValue: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#1A1A1A' },
  // Table
  tableHeader: { flexDirection: 'row', backgroundColor: '#0A0A0A', paddingVertical: 7, paddingHorizontal: 8, borderRadius: 3 },
  tableHeaderCell: { color: '#F5B700', fontSize: 7, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.3 },
  tableRow: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#F4F4F4' },
  tableRowAlt: { backgroundColor: '#FAFAFA' },
  tableCell: { fontSize: 8.5, color: '#1A1A1A' },
  colDesc: { flex: 4 },
  colQty: { flex: 1, textAlign: 'center' },
  colUnit: { flex: 1.5, textAlign: 'right' },
  colSubtotal: { flex: 1.5, textAlign: 'right' },
  // Totals
  totalsBlock: { alignItems: 'flex-end', marginTop: 16 },
  totalsInner: { width: 240 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  totalLabel: { fontSize: 8.5, color: '#555' },
  totalValue: { fontSize: 8.5, color: '#1A1A1A' },
  grandTotalRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#0A0A0A', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 3, marginTop: 4 },
  grandTotalLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#F5B700' },
  grandTotalValue: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#FFFFFF' },
  // Payment
  paymentBox: { marginTop: 28, borderWidth: 1, borderColor: '#E8E8E8', borderRadius: 4, padding: 14 },
  paymentTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#0A0A0A', marginBottom: 8 },
  paymentRow: { flexDirection: 'row', marginBottom: 3 },
  paymentKey: { fontSize: 7.5, color: '#888', width: 80 },
  paymentVal: { fontSize: 7.5, color: '#1A1A1A', flex: 1 },
  // Footer
  footer: { position: 'absolute', bottom: 24, left: 48, right: 48, borderTopWidth: 1, borderTopColor: '#E8E8E8', paddingTop: 10 },
  footerText: { fontSize: 7, color: '#AAA', textAlign: 'center', lineHeight: 1.6 },
})

interface InvoiceItem {
  description: string
  quantity: number
  unit_price: number
  subtotal: number
  position: number
}

interface InvoiceData {
  id: string
  invoice_number: string
  status: string
  currency: string
  subtotal: number
  discount: number | null
  tax: number | null
  total: number
  due_date: string | null
  issue_date: string | null
  paid_at: string | null
  notes: string | null
  created_at: string
}

interface ProfileData {
  full_name: string | null
  email: string | null
  phone: string | null
  country: string | null
}

interface BillingData {
  company_name: string
  logo_url: string | null
  email: string
  website: string
  phone: string | null
  address: string | null
  bank_name: string | null
  account_holder: string | null
  account_number: string | null
  iban: string | null
  swift: string | null
  payment_instructions: string | null
  footer_text: string | null
}

function fmt(amount: number | null | undefined, currency: string): string {
  if (amount == null) return `${currency} 0,00`
  return `${currency} ${amount.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const STATUS_COLORS: Record<string, string> = {
  paid: '#16A34A',
  pending: '#D97706',
  overdue: '#DC2626',
  cancelled: '#6B7280',
}
const STATUS_LABELS: Record<string, string> = {
  paid: 'PAGA',
  pending: 'PENDENTE',
  overdue: 'VENCIDA',
  cancelled: 'CANCELADA',
}

interface InvoicePDFProps {
  invoice: InvoiceData
  items: InvoiceItem[]
  profile: ProfileData
  billing: BillingData
}

export function InvoicePDF({ invoice, items, profile, billing }: InvoicePDFProps) {
  const statusColor = STATUS_COLORS[invoice.status] ?? '#6B7280'
  const hasBank = !!(billing.bank_name || billing.iban || billing.account_number)

  // Fallback items from invoice totals if no invoice_items rows
  const displayItems: InvoiceItem[] = items.length > 0 ? items : [
    {
      description: `Serviço ViralizaHost — Factura ${invoice.invoice_number}`,
      quantity: 1,
      unit_price: invoice.subtotal ?? invoice.total ?? 0,
      subtotal: invoice.subtotal ?? invoice.total ?? 0,
      position: 0,
    },
  ]

  return (
    <Document title={`Factura ${invoice.invoice_number} — ViralizaHost`} author="ViralizaHost">
      <Page size="A4" style={styles.page}>

        {/* Yellow accent line */}
        <View style={styles.yellowLine} />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.companyBlock}>
            <Text style={styles.companyName}>{billing.company_name}</Text>
            <Text style={styles.companyTagline}>Hospedagem Web · Domínios · E-mails Corporativos</Text>
            <Text style={styles.companyInfo}>
              {[billing.email, billing.website, billing.phone, billing.address].filter(Boolean).join('\n')}
            </Text>
          </View>
          <View style={styles.invoiceBlock}>
            <Text style={styles.invoiceTitle}>FACTURA</Text>
            <Text style={styles.invoiceNumber}>{invoice.invoice_number}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
              <Text style={{ color: '#fff', fontSize: 7, fontFamily: 'Helvetica-Bold' }}>
                {STATUS_LABELS[invoice.status] ?? invoice.status.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* Billing parties */}
        <View style={styles.billingRow}>
          <View style={styles.billingBlock}>
            <Text style={styles.billingLabel}>De</Text>
            <Text style={styles.billingValue}>
              {billing.company_name}{'\n'}
              {billing.email}{'\n'}
              {billing.website}
            </Text>
          </View>
          <View style={styles.billingBlock}>
            <Text style={styles.billingLabel}>Para</Text>
            <Text style={styles.billingValue}>
              {profile.full_name ?? 'Cliente'}{'\n'}
              {profile.email ?? ''}{profile.phone ? `\n${profile.phone}` : ''}{profile.country ? `\n${profile.country}` : ''}
            </Text>
          </View>
        </View>

        {/* Dates */}
        <View style={styles.datesRow}>
          <View style={styles.dateBlock}>
            <Text style={styles.dateLabel}>Data de Emissão</Text>
            <Text style={styles.dateValue}>{fmtDate(invoice.issue_date ?? invoice.created_at)}</Text>
          </View>
          <View style={styles.dateBlock}>
            <Text style={styles.dateLabel}>Data de Vencimento</Text>
            <Text style={styles.dateValue}>{fmtDate(invoice.due_date)}</Text>
          </View>
          {invoice.paid_at && (
            <View style={styles.dateBlock}>
              <Text style={styles.dateLabel}>Data de Pagamento</Text>
              <Text style={styles.dateValue}>{fmtDate(invoice.paid_at)}</Text>
            </View>
          )}
        </View>

        {/* Items table */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, styles.colDesc]}>Descrição</Text>
          <Text style={[styles.tableHeaderCell, styles.colQty]}>Qtd</Text>
          <Text style={[styles.tableHeaderCell, styles.colUnit]}>Preço Unit.</Text>
          <Text style={[styles.tableHeaderCell, styles.colSubtotal]}>Subtotal</Text>
        </View>
        {displayItems.map((item, idx) => (
          <View key={idx} style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}>
            <Text style={[styles.tableCell, styles.colDesc]}>{item.description}</Text>
            <Text style={[styles.tableCell, styles.colQty]}>{item.quantity}</Text>
            <Text style={[styles.tableCell, styles.colUnit]}>{fmt(item.unit_price, invoice.currency)}</Text>
            <Text style={[styles.tableCell, styles.colSubtotal]}>{fmt(item.subtotal, invoice.currency)}</Text>
          </View>
        ))}

        {/* Totals */}
        <View style={styles.totalsBlock}>
          <View style={styles.totalsInner}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>{fmt(invoice.subtotal, invoice.currency)}</Text>
            </View>
            {(invoice.discount ?? 0) > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Desconto</Text>
                <Text style={[styles.totalValue, { color: '#16A34A' }]}>- {fmt(invoice.discount, invoice.currency)}</Text>
              </View>
            )}
            {(invoice.tax ?? 0) > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>IVA / Imposto</Text>
                <Text style={styles.totalValue}>{fmt(invoice.tax, invoice.currency)}</Text>
              </View>
            )}
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>TOTAL</Text>
              <Text style={styles.grandTotalValue}>{fmt(invoice.total, invoice.currency)}</Text>
            </View>
          </View>
        </View>

        {/* Payment instructions */}
        {hasBank && invoice.status !== 'paid' && (
          <View style={styles.paymentBox}>
            <Text style={styles.paymentTitle}>Dados para Pagamento por Transferência</Text>
            {billing.bank_name && (
              <View style={styles.paymentRow}>
                <Text style={styles.paymentKey}>Banco</Text>
                <Text style={styles.paymentVal}>{billing.bank_name}</Text>
              </View>
            )}
            {billing.account_holder && (
              <View style={styles.paymentRow}>
                <Text style={styles.paymentKey}>Titular</Text>
                <Text style={styles.paymentVal}>{billing.account_holder}</Text>
              </View>
            )}
            {billing.account_number && (
              <View style={styles.paymentRow}>
                <Text style={styles.paymentKey}>Nº de Conta</Text>
                <Text style={styles.paymentVal}>{billing.account_number}</Text>
              </View>
            )}
            {billing.iban && (
              <View style={styles.paymentRow}>
                <Text style={styles.paymentKey}>IBAN</Text>
                <Text style={styles.paymentVal}>{billing.iban}</Text>
              </View>
            )}
            {billing.swift && (
              <View style={styles.paymentRow}>
                <Text style={styles.paymentKey}>SWIFT/BIC</Text>
                <Text style={styles.paymentVal}>{billing.swift}</Text>
              </View>
            )}
            {billing.payment_instructions && (
              <Text style={{ fontSize: 7.5, color: '#555', marginTop: 8, lineHeight: 1.5 }}>
                {billing.payment_instructions}
              </Text>
            )}
          </View>
        )}

        {/* Notes */}
        {invoice.notes && (
          <View style={{ marginTop: 16 }}>
            <Text style={[styles.billingLabel, { marginBottom: 4 }]}>Notas</Text>
            <Text style={{ fontSize: 8, color: '#555', lineHeight: 1.5 }}>{invoice.notes}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {billing.footer_text ?? `${billing.company_name} · ${billing.email} · ${billing.website}`}
          </Text>
        </View>

      </Page>
    </Document>
  )
}
