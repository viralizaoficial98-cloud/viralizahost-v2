import { createAdminWriteClient } from '@/lib/supabase/server'
import { decryptSecret } from '@/lib/crypto'
import type { WHMConfig } from './client'

const WHM_CONFIG_NAME = '__whm_config__'

export interface WhmConfigResult {
  config: WHMConfig
  serverId: string
}

export async function loadWhmConfig(): Promise<WhmConfigResult | null> {
  const db = createAdminWriteClient()
  const { data } = await db
    .from('servers')
    .select('id, whm_url, whm_api_token, whm_username')
    .eq('name', WHM_CONFIG_NAME)
    .maybeSingle()

  if (!data?.whm_url || !data?.whm_api_token) return null

  const token = decryptSecret(data.whm_api_token as string)
  if (!token) return null

  return {
    config: {
      url:      data.whm_url as string,
      token,
      username: (data.whm_username as string | null) ?? 'root',
    },
    serverId: data.id as string,
  }
}
