import { streamText, isStepCount } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient, createAdminWriteClient } from '@/lib/supabase/server'
import { buildSystemPrompt, type UserLevel } from '@/lib/agent/system-prompt'
import { buildTools } from '@/lib/agent/tools'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { messages, conversationId } = body as {
      messages: Array<{ role: 'user' | 'assistant'; content: string }>
      conversationId?: string
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages é obrigatório e deve ser um array.' }, { status: 400 })
    }

    // Validate messages structure
    const validMessages = messages.filter(m =>
      m && typeof m.content === 'string' && m.content.trim() &&
      (m.role === 'user' || m.role === 'assistant')
    )
    if (!validMessages.length) {
      return NextResponse.json({ error: 'Nenhuma mensagem válida encontrada.' }, { status: 400 })
    }

    // ── Identify user server-side (never trust frontend) ──────────
    const auth = await createAuthClient()
    const { data: { user } } = await auth.auth.getUser()

    const db = createAdminWriteClient()
    let userLevel: UserLevel = 'visitor'
    let profileId: string | undefined
    let userName: string | undefined
    let userEmail: string | undefined

    if (user) {
      profileId = user.id
      userEmail = user.email ?? undefined

      const { data: profile } = await db
        .from('profiles')
        .select('role, full_name')
        .eq('id', user.id)
        .maybeSingle()

      if (profile) {
        userName = profile.full_name ?? undefined
        userLevel = profile.role === 'admin' ? 'admin' : 'client'
      }
    }

    // ── Persist / resume conversation ─────────────────────────────
    let convId = conversationId

    if (!convId) {
      const title = validMessages.find(m => m.role === 'user')?.content?.slice(0, 80) ?? 'Nova conversa'
      const { data: conv } = await db
        .from('ai_conversations')
        .insert({
          profile_id: profileId ?? null,
          user_level: userLevel,
          title,
        })
        .select('id')
        .single()
      convId = conv?.id
    } else {
      // Validate that the conversation exists and belongs to this user
      const { data: existing } = await db
        .from('ai_conversations')
        .select('id, profile_id')
        .eq('id', convId)
        .maybeSingle()

      if (!existing) convId = undefined // reset if not found
      else if (existing.profile_id && existing.profile_id !== profileId) {
        // Security: don't allow accessing another user's conversation
        return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
      }
    }

    // Persist user message (non-fatal)
    const lastUser = [...validMessages].reverse().find(m => m.role === 'user')
    if (convId && lastUser) {
      void db.from('ai_messages').insert({
        conversation_id: convId,
        role: 'user',
        content: lastUser.content,
      })
    }

    // ── Build system prompt and tools ─────────────────────────────
    const systemPrompt = buildSystemPrompt({
      userLevel,
      userName,
      userEmail,
      currentDate: new Date().toLocaleDateString('pt-PT', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      }),
    })

    const tools = buildTools({ userLevel, profileId })

    // ── Stream ────────────────────────────────────────────────────
    const result = streamText({
      model: anthropic('claude-haiku-4-5-20251001'),
      system: systemPrompt,
      messages: validMessages,
      tools,
      stopWhen: isStepCount(8),
      onFinish: async ({ text, usage }) => {
        if (!convId) return
        const content = text?.trim()
        if (!content) return
        void db.from('ai_messages').insert({
          conversation_id: convId,
          role: 'assistant',
          content,
          tokens_used: usage?.totalTokens ?? null,
        })
        // Update conversation timestamp
        void db.from('ai_conversations').update({ updated_at: new Date().toISOString() }).eq('id', convId)
      },
    })

    const response = result.toTextStreamResponse({
      headers: {
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
        ...(convId ? { 'X-Conversation-Id': convId } : {}),
      },
    })

    return response

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    console.error('[/api/agent/chat]', msg)
    // Never expose internal error details to the client
    return NextResponse.json({ error: 'O assistente não está disponível de momento. Tente novamente.' }, { status: 500 })
  }
}
