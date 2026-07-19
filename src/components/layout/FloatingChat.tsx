'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { X, Send, Loader2, RefreshCw, Minimize2 } from 'lucide-react'
import { AvatarIA } from './AvatarIA'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const WELCOME: Message = {
  id: 'welcome',
  role: 'assistant',
  content: 'Olá! Eu sou a Cizesa. Como posso te ajudar?',
}

/** Very light markdown: bold, inline code, lists, line breaks */
function renderMarkdown(text: string) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []

  lines.forEach((line, i) => {
    const trimmed = line.trim()
    if (!trimmed) {
      elements.push(<br key={i} />)
      return
    }

    // List item
    if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
      elements.push(
        <div key={i} className="flex gap-1.5 my-0.5">
          <span className="text-[#F5B700] shrink-0 mt-0.5">•</span>
          <span>{inlineFormat(trimmed.slice(2))}</span>
        </div>
      )
      return
    }

    // Numbered list
    const numMatch = trimmed.match(/^(\d+)\.\s(.+)/)
    if (numMatch) {
      elements.push(
        <div key={i} className="flex gap-1.5 my-0.5">
          <span className="text-[#F5B700] shrink-0 font-bold">{numMatch[1]}.</span>
          <span>{inlineFormat(numMatch[2])}</span>
        </div>
      )
      return
    }

    // Heading (##)
    if (trimmed.startsWith('## ')) {
      elements.push(<p key={i} className="font-bold text-[#0A0A0A] mt-2 mb-0.5">{inlineFormat(trimmed.slice(3))}</p>)
      return
    }
    if (trimmed.startsWith('### ')) {
      elements.push(<p key={i} className="font-semibold mt-1.5">{inlineFormat(trimmed.slice(4))}</p>)
      return
    }

    elements.push(<p key={i} className="my-0.5">{inlineFormat(trimmed)}</p>)
  })

  return <>{elements}</>
}

function inlineFormat(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-[#0A0A0A]">{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="bg-[#F0F0F0] px-1 py-0.5 rounded text-xs font-mono">{part.slice(1, -1)}</code>
    }
    return part
  })
}

export function FloatingChat({ pageContext }: { pageContext?: string } = {}) {
  const [open, setOpen] = useState(false)
  const [badge, setBadge] = useState(true)
  const [messages, setMessages] = useState<Message[]>([WELCOME])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [streaming, setStreaming] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (messages.length > 1 || streaming) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, streaming])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150)
  }, [open])

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isLoading) return
    setError(null)

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: trimmed }
    const historyForApi = [...messages.filter(m => m.id !== 'welcome'), userMsg]
      .map(m => ({ role: m.role, content: m.content }))

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    const assistantId = crypto.randomUUID()

    try {
      abortRef.current = new AbortController()

      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: historyForApi, conversationId, pageContext }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `Erro ${res.status}`)
      }

      const convId = res.headers.get('X-Conversation-Id')
      if (convId && !conversationId) setConversationId(convId)

      const reader = res.body?.getReader()
      if (!reader) throw new Error('Sem stream de resposta.')

      setStreaming(true)
      setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }])

      const decoder = new TextDecoder()
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        fullText += chunk
        setMessages(prev =>
          prev.map(m => m.id === assistantId ? { ...m, content: fullText } : m)
        )
      }

      // Ensure final state
      setMessages(prev =>
        prev.map(m => m.id === assistantId ? { ...m, content: fullText } : m)
      )

    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      const errMsg = err instanceof Error ? err.message : 'Erro inesperado.'
      setError(errMsg)
      // Remove failed assistant message if empty
      setMessages(prev => prev.filter(m => m.id !== assistantId || m.content))
    } finally {
      setIsLoading(false)
      setStreaming(false)
      abortRef.current = null
    }
  }, [messages, conversationId, isLoading])

  const handleOpen = () => { setOpen(true); setBadge(false) }

  const handleReset = () => {
    abortRef.current?.abort()
    setMessages([WELCOME])
    setConversationId(null)
    setError(null)
    setIsLoading(false)
    setStreaming(false)
    setInput('')
  }

  const quickQuestions = [
    'Quais são os planos de hospedagem?',
    'Quero verificar um domínio',
    'Preciso de suporte técnico',
    'Como configurar e-mail no Outlook?',
  ]

  const showQuickQuestions = messages.length <= 1 && !isLoading

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <div
          className="w-[360px] bg-white rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.25)] border border-[#E8E8E8] overflow-hidden flex flex-col"
          style={{ maxHeight: 'calc(100dvh - 100px)', animation: 'slideUp 0.2s ease' }}
        >
          {/* Header */}
          <div className="bg-[#0A0A0A] px-4 py-2.5 flex items-center gap-3 shrink-0">
            <AvatarIA size={44} showBadge={false} showOnline={true} className="shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm leading-tight">CIZESA</p>
              <p className={`text-[11px] mt-0.5 ${streaming ? 'text-[#F5B700]' : 'text-green-400'}`}>
                {streaming ? '● A escrever...' : '● IA · Disponível 24/7'}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={handleReset}
                title="Nova conversa"
                className="text-gray-500 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10"
              >
                <RefreshCw size={14} />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-500 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10"
                aria-label="Minimizar"
              >
                <Minimize2 size={14} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div
            className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#F8F8F8]"
            style={{ minHeight: 220, overscrollBehavior: 'contain' }}
          >
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} items-end gap-2`}>
                {msg.role === 'assistant' && (
                  <AvatarIA size={24} showBadge={false} showOnline={false} className="shrink-0" />
                )}
                <div
                  className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed break-words ${
                    msg.role === 'user'
                      ? 'bg-[#0A0A0A] text-white rounded-br-sm'
                      : 'bg-white border border-[#E4E4E4] text-[#1A1A1A] rounded-bl-sm shadow-sm'
                  }`}
                >
                  {msg.role === 'assistant' && msg.content
                    ? renderMarkdown(msg.content)
                    : msg.content}
                  {msg.role === 'assistant' && !msg.content && streaming && (
                    <span className="inline-flex gap-1 py-0.5">
                      <span className="w-1.5 h-1.5 bg-[#F5B700] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-[#F5B700] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-[#F5B700] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                  )}
                </div>
              </div>
            ))}

            {isLoading && !streaming && (
              <div className="flex items-end gap-2">
                <AvatarIA size={24} showBadge={false} showOnline={false} className="shrink-0" />
                <div className="bg-white border border-[#E4E4E4] rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                  <span className="inline-flex gap-1">
                    <span className="w-1.5 h-1.5 bg-[#F5B700] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-[#F5B700] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-[#F5B700] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 text-xs text-red-600">
                <span className="shrink-0">⚠️</span>
                <span className="flex-1">{error}</span>
                <button
                  onClick={() => setError(null)}
                  className="shrink-0 text-red-400 hover:text-red-600"
                >
                  <X size={12} />
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick questions */}
          {showQuickQuestions && (
            <div className="px-3 pt-1.5 pb-1 flex flex-col gap-1.5 border-t border-[#F0F0F0] bg-white shrink-0">
              <p className="text-[10px] text-gray-400 font-medium px-1">SUGESTÕES RÁPIDAS</p>
              <div className="flex flex-col gap-1">
                {quickQuestions.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    disabled={isLoading}
                    className="text-left text-xs px-3 py-2 rounded-xl border border-[#E8E8E8] hover:border-[#F5B700] hover:bg-[#FFFBEE] text-[#333] transition-colors disabled:opacity-50"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input area */}
          <div className="p-3 border-t border-[#F0F0F0] bg-white shrink-0">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage(input)
                  }
                }}
                placeholder="Escreva a sua mensagem..."
                disabled={isLoading}
                maxLength={2000}
                className="flex-1 text-[13px] px-3.5 py-2.5 rounded-xl border border-[#E0E0E0] outline-none focus:border-[#F5B700] focus:ring-2 focus:ring-[#F5B700]/10 transition-all text-[#0A0A0A] placeholder:text-[#BBB] disabled:opacity-60 bg-[#FAFAFA]"
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={isLoading || !input.trim()}
                className="w-10 h-10 bg-[#F5B700] hover:bg-[#E0A800] active:bg-[#C89600] disabled:opacity-40 rounded-xl flex items-center justify-center transition-colors shrink-0"
                aria-label="Enviar"
              >
                {isLoading
                  ? <Loader2 size={14} className="text-black animate-spin" />
                  : <Send size={14} className="text-black" />
                }
              </button>
            </div>
            <p className="text-center text-[10px] text-gray-300 mt-1.5">
              ViralizaHost IA · Respostas podem conter erros
            </p>
          </div>
        </div>
      )}

      {/* FAB trigger */}
      <div className="flex items-center gap-3">
        {!open && (
          <div
            className="bg-white border border-[#E8E8E8] rounded-2xl px-3.5 py-2 shadow-lg text-[11px] font-semibold text-[#0A0A0A] cursor-pointer hover:border-[#2F80ED] hover:shadow-[0_4px_20px_rgba(47,128,237,0.18)] transition-all"
            onClick={handleOpen}
            style={{ animation: badge ? 'fabLabelPulse 2.5s ease-in-out infinite' : 'none' }}
          >
            Fale com a IA
          </div>
        )}
        <button
          onClick={open ? () => setOpen(false) : handleOpen}
          className="relative transition-all active:scale-95"
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
          aria-label={open ? 'Fechar assistente' : 'Abrir assistente virtual'}
        >
          {open ? (
            <div className="w-14 h-14 bg-[#0A0A0A] hover:bg-[#1A1A1A] rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.4)] flex items-center justify-center transition-colors">
              <X size={22} className="text-white" />
            </div>
          ) : (
            <AvatarIA size={56} showBadge={badge} showOnline={true} />
          )}
        </button>
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes fabLabelPulse {
          0%,100% { box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
          50%      { box-shadow: 0 4px 20px rgba(47,128,237,0.22); }
        }
      `}</style>
    </div>
  )
}
