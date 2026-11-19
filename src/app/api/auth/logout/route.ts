import { NextResponse } from 'next/server'
import { destroyCurrentSession } from '@/lib/auth/server'

export const dynamic = 'force-dynamic'

export async function POST() {
  await destroyCurrentSession()
  return NextResponse.json({ ok: true })
}
