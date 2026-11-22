import 'server-only'
import { getPool } from '@/lib/db/pool'
import { decryptSecret } from '@/lib/crypto'
import type { WHMConfig } from './client'

// Mecanismo ÚNICO para obter as credenciais WHM: todas as rotas (activação, SSO do
// cPanel/Webmail, importação, sincronização, acções do painel) passam por aqui.
// O token está cifrado na base (AES-256-GCM, WHM_ENCRYPTION_KEY) e só é decifrado
// no servidor, no momento da chamada. Nunca é devolvido ao navegador nem registado.

export const WHM_CONFIG_NAME = '__whm_config__'

export interface WhmConfigResult {
  config: WHMConfig
  serverId: string
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Credenciais do servidor WHM indicado; sem argumento, a configuração principal
 * (Configurações → WHM). Devolve null se faltar URL/token ou se o token não puder ser decifrado.
 */
export async function loadWhmConfig(serverId?: string | null): Promise<WhmConfigResult | null> {
  const [rows] = await getPool().query(
    serverId
      ? 'SELECT id, whm_url, whm_api_token, whm_username FROM servers WHERE id = ? LIMIT 1'
      : 'SELECT id, whm_url, whm_api_token, whm_username FROM servers WHERE name = ? LIMIT 1',
    [serverId || WHM_CONFIG_NAME],
  ) as any
  const data = rows[0]
  if (!data?.whm_url || !data?.whm_api_token) return null
  const token = decryptSecret(String(data.whm_api_token))
  if (!token) return null
  return { config: { url: String(data.whm_url), token, username: data.whm_username ?? 'root' }, serverId: String(data.id) }
}

/** Indica se o token guardado está cifrado (sem o decifrar). */
export function isEncryptedToken(stored: string | null | undefined) {
  return !!stored && stored.startsWith('enc:')
}
