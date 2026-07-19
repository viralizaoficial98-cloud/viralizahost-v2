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

    if (!messages?.length) {
      return NextResponse.json({ error: 'messages required' }, { status: 400 })
    }

    // ── Identify user (never trust frontend) ─────────────────────
    const auth = await createAuthClient()
    const { data: { user } } = await auth.auth.getUser()

    const db = createAdminWriteClient()
    let userLevel: UserLevel = 'visitor'
    let profileId: string | undefined
    let userName: string | undefined
    let userEmail: string | undefined

    if (user) {
      profileId = user.id
      userEmail = user.email

      const { data: profile } = await db
        .from('profiles')
        .select('role, full_name')
        .eq('id', user.id)
        .single()

      if (profile) {
        userName = profile.full_name ?? undefined
        userLevel = profile.role === 'admin' ? 'admin' : 'client'
      }
    }

    // ── Persist / load conversation ───────────────────────────────
    let convId = conversationId
    if (!convId) {
      const { data: conv } = await db
        .from('ai_conversations')
        .insert({
          profile_id: profileId ?? null,
          user_level: userLevel,
          title: messages[0]?.content?.slice(0, 80) ?? 'Nova conversa',
        })
        .select('id')
        .single()
      convId = conv?.id
    }

    // Save the last user message (non-fatal)
    const lastUserMessage = messages[messages.length - 1]
    if (convId && lastUserMessage?.role === 'user') {
      void db.from('ai_messages').insert({
        conversation_id: convId,
        role: 'user',
        content: lastUserMessage.content,
      })
    }

    // ── Build context ─────────────────────────────────────────────
    const systemPrompt = buildSystemPrompt({
      userLevel,
      userName,
      userEmail,
      currentDate: new Date().toLocaleDateString('pt-PT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    })

    const tools = buildTools({ userLevel, profileId })

    // ── Stream response ───────────────────────────────────────────
    const result = streamText({
      model: anthropic('claude-haiku-4-5-20251001'),
      system: systemPrompt,
      messages,
      tools,
      stopWhen: isStepCount(5),
      onFinish: async ({ text, usage }) => {
        if (!convId || !text) return
        void db.from('ai_messages').insert({
          conversation_id: convId,
          role: 'assistant',
          content: text,
          tokens_used: usage?.totalTokens,
        })
      },
    })

    const response = result.toTextStreamResponse()
    if (convId) {
      response.headers.set('X-Conversation-Id', convId)
    }
    return response

  } catch (err) {
    console.error('[/api/agent/chat] error:', err)
    return NextResponse.json({ error: 'Erro interno do agente.' }, { status: 500 })
  }
}
