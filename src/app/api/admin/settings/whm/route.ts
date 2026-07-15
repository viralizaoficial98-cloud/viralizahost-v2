import { NextRequest, NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { createAdminWriteClient } from '@/lib/supabase/server'
import { encryptSecret, decryptSecret } from '@/lib/crypto'
import { testConnection, normalizeWhmUrl } from '@/lib/whm/client'

// Sentinel name used to identify the global WHM config record in the servers table
const WHM_CONFIG_NAME = '__whm_config__'

// ── Helpers ──────────────────────────────────────────────────────────────────

function maskToken(token: string): string {
  return token ? '••••••••••••••••••••' : ''
}

function getServerRecord(db: ReturnType<typeof createAdminWriteClient>) {
  return db
    .from('servers')
    .select('id, whm_url, whm_api_token, whm_username')
    .eq('name', WHM_CONFIG_NAME)
    .maybeSingle()
}

// ── GET /api/admin/settings/whm ───────────────────────────────────────────────
// Returns current WHM config with masked token.

export async function GET() {
  try {
    await requireAdminRole()

    const db = createAdminWriteClient()
    const { data, error } = await getServerRecord(db)

    if (error) {
      console.error('[settings/whm GET] DB error:', error.message)
      return NextResponse.json({ error: 'Erro ao carregar configuração.' }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ configured: false, url: '', username: '', hasToken: false })
    }

    const storedToken = data.whm_api_token ?? ''
    const decrypted   = decryptSecret(storedToken)

    return NextResponse.json({
      configured: !!(data.whm_url && decrypted),
      url:        data.whm_url        ?? '',
      username:   data.whm_username   ?? 'root',
      hasToken:   !!decrypted,
      tokenMask:  maskToken(decrypted),
    })
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number }
    return NextResponse.json({ error: e.message ?? 'Erro interno' }, { status: e.status ?? 500 })
  }
}

// ── POST /api/admin/settings/whm ──────────────────────────────────────────────
// Validates fields, tests connection, saves on success.
// Body: { url, token?, username, keepToken? }
// If keepToken === true and token is falsy → keep the stored token unchanged.

export async function POST(req: NextRequest) {
  try {
    await requireAdminRole()

    const body = await req.json()
    const { url: rawUrl, token: rawToken, username: rawUsername, keepToken } = body as {
      url: string
      token?: string
      username: string
      keepToken?: boolean
    }

    // ── 1. Validate inputs ────────────────────────────────────────────────────
    if (!rawUrl?.trim()) {
      return NextResponse.json({ error: 'URL do servidor WHM é obrigatória.' }, { status: 400 })
    }
    if (!rawUsername?.trim()) {
      return NextResponse.json({ error: 'Username Admin é obrigatório.' }, { status: 400 })
    }

    const normalizedUrl = normalizeWhmUrl(rawUrl)
    const username      = rawUsername.trim()

    // ── 2. Resolve token ──────────────────────────────────────────────────────
    const db = createAdminWriteClient()
    let activeToken: string

    if (keepToken && !rawToken?.trim()) {
      // User didn't change the token — load stored one
      const { data: current } = await getServerRecord(db)
      const stored = current?.whm_api_token ?? ''
      activeToken  = decryptSecret(stored)
      if (!activeToken) {
        return NextResponse.json({ error: 'Nenhum API Token guardado. Por favor insira o token.' }, { status: 400 })
      }
    } else {
      if (!rawToken?.trim()) {
        return NextResponse.json({ error: 'API Token WHM é obrigatório.' }, { status: 400 })
      }
      activeToken = rawToken.trim()
    }

    // ── 3. Test connection ────────────────────────────────────────────────────
    console.log('[settings/whm POST] testing connection to', normalizedUrl, 'as', username)

    const result = await testConnection({ url: normalizedUrl, token: activeToken, username })

    if (!result.success) {
      console.warn('[settings/whm POST] connection test failed:', result.error)
      return NextResponse.json(
        { error: result.error ?? 'Falha na ligação ao WHM.', testedAt: result.testedAt },
        { status: 422 }
      )
    }

    // ── 4. Save on success ────────────────────────────────────────────────────
    const encryptedToken = encryptSecret(activeToken)
    const hostname       = result.version?.hostname ?? new URL(normalizedUrl).hostname

    // Upsert the sentinel config record
    const { data: existing } = await getServerRecord(db)

    if (existing) {
      const { error: updateErr } = await db
        .from('servers')
        .update({
          whm_url:       normalizedUrl,
          whm_api_token: encryptedToken,
          whm_username:  username,
          hostname,
          is_active:     true,
        })
        .eq('id', existing.id)

      if (updateErr) {
        console.error('[settings/whm POST] update error:', updateErr.message)
        return NextResponse.json({ error: 'Ligação bem-sucedida mas ocorreu erro ao guardar.' }, { status: 500 })
      }
    } else {
      const { error: insertErr } = await db
        .from('servers')
        .insert({
          name:          WHM_CONFIG_NAME,
          hostname,
          ip_address:    '0.0.0.0',      // resolved at runtime
          location:      'AO',
          whm_url:       normalizedUrl,
          whm_api_token: encryptedToken,
          whm_username:  username,
          is_active:     true,
          max_accounts:  0,
          current_load:  0,
          notes:         'Configuração global do WHM — gerida pelo painel de administração',
        })

      if (insertErr) {
        console.error('[settings/whm POST] insert error:', insertErr.message)
        return NextResponse.json({ error: 'Ligação bem-sucedida mas ocorreu erro ao guardar.' }, { status: 500 })
      }
    }

    console.log('[settings/whm POST] config saved — hostname:', hostname, 'accounts:', result.accountCount)

    return NextResponse.json({
      success:      true,
      hostname:     result.version?.hostname,
      version:      result.version?.version,
      release:      result.version?.release,
      accountCount: result.accountCount,
      username,
      testedAt:     result.testedAt,
    })

  } catch (err: unknown) {
    const e = err as { message?: string; status?: number }
    console.error('[settings/whm POST] unexpected error:', e.message)
    return NextResponse.json({ error: e.message ?? 'Erro interno do servidor.' }, { status: e.status ?? 500 })
  }
}
