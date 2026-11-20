import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/server'

export const dynamic = 'force-dynamic'

export async function POST() {
  return NextResponse.json({ user: await getSessionUser() })
}
export const GET = POST
