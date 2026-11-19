import 'server-only'
/* eslint-disable @typescript-eslint/no-explicit-any -- espelha a tipagem 'any' do supabase-js sem tipos gerados */
import type { Queryable } from './pool'

// Equivalentes aos triggers e DEFAULTs PostgreSQL que não têm tradução directa
// em MariaDB. Correm dentro da mesma ligação/transacção da escrita.

type Row = Record<string, unknown>

async function one<T = any>(db: Queryable, sql: string, params: unknown[]): Promise<T | undefined> {
  const [rows] = await db.query(sql, params)
  return (rows as T[])[0]
}

/** trigger set_ticket_number → generate_ticket_number(): VH-TKT-AAAA-NNNNNN (sempre sobrescreve). */
async function nextTicketNumber(db: Queryable): Promise<string> {
  const year = new Date().getUTCFullYear()
  const r = await one<{ n: number }>(db,
    "SELECT COUNT(*) + 1 AS n FROM `tickets` WHERE ticket_number LIKE ?", [`VH-TKT-${year}-%`])
  return `VH-TKT-${year}-${String(r?.n ?? 1).padStart(6, '0')}`
}

/** DEFAULT de invoices.invoice_number: 'INV-' || AAAA || '-' || lpad(floor(random()*99999), 5, '0'). */
function defaultInvoiceNumber(): string {
  const n = Math.floor(Math.random() * 99999)
  return `INV-${new Date().getUTCFullYear()}-${String(n).padStart(5, '0')}`
}

export async function beforeInsert(table: string, rows: Row[], db: Queryable): Promise<void> {
  if (table === 'tickets') {
    // Linhas do mesmo lote recebem números consecutivos.
    const first = await nextTicketNumber(db)
    const [, prefix, seq] = first.match(/^(VH-TKT-\d{4}-)(\d+)$/)!
    rows.forEach((row, i) => { row.ticket_number = prefix + String(Number(seq) + i).padStart(6, '0') })
  }
  if (table === 'invoices') {
    for (const row of rows) if (row.invoice_number == null) row.invoice_number = defaultInvoiceNumber()
  }
}

/** trigger trg_sync_invoice_proof → sync_invoice_proof_file() (AFTER INSERT OR UPDATE em payments). */
export async function afterWrite(table: string, rows: Row[], db: Queryable): Promise<void> {
  if (table !== 'payments') return
  for (const p of rows) {
    if (p.proof_url != null && p.invoice_id != null) {
      await db.query(
        "UPDATE `invoices` SET proof_file = ?, updated_at = CURRENT_TIMESTAMP(6) WHERE id = ? AND (proof_file IS NULL OR proof_file = '')",
        [p.proof_url, p.invoice_id],
      )
    }
  }
}

/** Tabelas com hooks que precisam das linhas completas depois da escrita. */
export const AFTER_WRITE_TABLES = new Set(['payments'])
