import { NextRequest } from 'next/server'
import { handleSso } from '@/lib/whm/sso'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ serviceId: string }> },
) {
  const { serviceId } = await params
  return handleSso(req, serviceId, 'cpanel')
}
