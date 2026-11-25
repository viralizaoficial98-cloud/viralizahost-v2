import 'server-only'
import { NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { createAuthClient } from '@/lib/supabase/server'
import { ResellerError } from './settings'

// Respostas das rotas da Revenda: erros conhecidos com mensagem; o resto genérico (sem detalhes internos).
export const noStore = { 'Cache-Control': 'no-store' }
export async function adminGuard(): Promise<string | NextResponse> {
  try { return await requireAdminRole() } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: (e as { status?: number }).status ?? 401 }) }
}
export async function currentUserId(): Promise<string | null> {
  const { data: { user } } = await (await createAuthClient()).auth.getUser()
  return user?.id ?? null
}
export function fail(e: unknown, tag: string) {
  if (e instanceof ResellerError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status, headers: noStore })
  console.error(`[${tag}]`, (e as Error)?.message)
  return NextResponse.json({ error: 'Não foi possível concluir a operação.' }, { status: 500, headers: noStore })
}
