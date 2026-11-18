/*
 * Equivalentes, em código, dos triggers do PostgreSQL que não foram para o MySQL
 * (contas cPanel normalmente não têm privilégio para criar triggers quando o binlog está ativo).
 *
 *   tickets   BEFORE INSERT  generate_ticket_number   → beforeInsert
 *   payments  AFTER INSERT/UPDATE sync_invoice_proof_file → afterWrite
 *   *.updated_at BEFORE UPDATE set_updated_at         → ON UPDATE CURRENT_TIMESTAMP(6) no próprio schema
 *   auth.users AFTER INSERT/UPDATE handle_new_user / handle_user_email_updated → context.ts (ensureProfile)
 */
import type { PoolConnection, RowDataPacket } from 'mysql2/promise'

type Row = Record<string, unknown>

export type TableHooks = {
  beforeInsert?: (rows: Row[], conn: PoolConnection) => Promise<void>
  afterWrite?: (pks: unknown[], conn: PoolConnection) => Promise<void>
}

export const HOOKS: Record<string, TableHooks> = {
  tickets: {
    // VH-TKT-<ano>-<nnnnnn>, sequência anual — mesma lógica (e mesma origem da contagem) que o trigger original
    async beforeInsert(rows, conn) {
      const year = new Date().getUTCFullYear()
      const [[r]] = await conn.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM `tickets` WHERE `ticket_number` LIKE ? FOR UPDATE', [`VH-TKT-${year}-%`])
      let seq = Number(r.n)
      for (const row of rows) {
        seq += 1
        row.ticket_number = `VH-TKT-${year}-${String(seq).padStart(6, '0')}`
      }
    },
  },
  payments: {
    async afterWrite(pks, conn) {
      if (!pks.length) return
      await conn.query(
        `UPDATE \`invoices\` i JOIN \`payments\` p ON p.\`invoice_id\` = i.\`id\`
         SET i.\`proof_file\` = p.\`proof_url\`, i.\`updated_at\` = UTC_TIMESTAMP(6)
         WHERE p.\`id\` IN (${pks.map(() => '?').join(', ')})
           AND p.\`proof_url\` IS NOT NULL AND (i.\`proof_file\` IS NULL OR i.\`proof_file\` = '')`, pks)
    },
  },
}
