import { NextResponse } from 'next/server'
import { adminGuard } from '@/lib/api/require-admin'
import { pendingActions } from '@/lib/admin/pending'

export const dynamic = 'force-dynamic'

export async function GET() {
  const denied = await adminGuard(); if (denied) return denied
  return NextResponse.json({ categories: await pendingActions(), at: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } })
}
