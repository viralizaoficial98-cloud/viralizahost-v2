import { NextResponse } from 'next/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ARCHIVE_COMMIT, ARCHIVE_DATE } from '@/lib/release-id'

export const dynamic = 'force-dynamic'

// Versão em execução (para verificar o deploy): commit da release e data. Sem segredos.
export function GET() {
  const hex = (v: string) => (/^[0-9a-f]{40}$/.test(v) ? v : null)
  let commit = hex(ARCHIVE_COMMIT), source = commit ? 'git-archive' : null
  if (!commit) {
    try { commit = hex(readFileSync(join(process.cwd(), 'RELEASE_COMMIT'), 'utf8').trim()); if (commit) source = 'RELEASE_COMMIT' } catch { /* sem ficheiro */ }
  }
  return NextResponse.json(
    { commit, short: commit?.slice(0, 7) ?? null, committed_at: commit && source === 'git-archive' ? ARCHIVE_DATE : null, source: source ?? 'desconhecida', environment: process.env.NODE_ENV },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
