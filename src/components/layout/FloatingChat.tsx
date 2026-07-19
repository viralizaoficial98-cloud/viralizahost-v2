'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { X, Send, Bot, Loader2, ChevronDown, RefreshCw, Minimize2 } from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const WELCOME: Message = {
  id: 'welcome',
  role: 'assistant',
  content: 'Olá! 👋 Sou o assistente virtual da **ViralizaHost**.\n\nPosso ajudar com:\n- Planos de hospedagem e preços\n- Domínios e DNS\n- E-mail corporativo\n- Suporte técnico\n- Acesso ao cPanel\n\nComo posso ajudar hoje?',
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
          <div className="bg-[#0A0A0A] px-4 py-3 flex items-center gap-3 shrink-0">
            <div className="relative shrink-0">
              <div className="w-9 h-9 rounded-full bg-[#F5B700] flex items-center justify-center">
                <Bot size={18} className="text-black" />
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 border-2 border-[#0A0A0A] rounded-full" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm">Assistente ViralizaHost</p>
              <p className="text-green-400 text-[11px]">
                {streaming ? 'A escrever...' : 'IA · Disponível 24/7'}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={handleReset}
                title="Nova conversa"
                className="text-gray-600 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10"
              >
                <RefreshCw size={14} />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-600 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10"
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
                  <div className="w-6 h-6 rounded-full bg-[#F5B700]/20 border border-[#F5B700]/40 flex items-center justify-center shrink-0">
                    <Bot size={12} className="text-[#A07000]" />
                  </div>
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
                <div className="w-6 h-6 rounded-full bg-[#F5B700]/20 border border-[#F5B700]/40 flex items-center justify-center shrink-0">
                  <Bot size={12} className="text-[#A07000]" />
                </div>
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
        {!open && !isLoading && (
          <div
            className="bg-white border border-[#E8E8E8] rounded-2xl px-3.5 py-2 shadow-lg text-[11px] font-semibold text-[#0A0A0A] cursor-pointer"
            onClick={handleOpen}
          >
            Fale com a IA
          </div>
        )}
        <button
          onClick={open ? () => setOpen(false) : handleOpen}
          className="relative w-14 h-14 bg-[#0A0A0A] hover:bg-[#1C1C1C] rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.32)] flex items-center justify-center transition-all hover:scale-105 active:scale-95"
          aria-label={open ? 'Fechar assistente' : 'Abrir assistente virtual'}
        >
          {open
            ? <X size={20} className="text-white" />
            : <Bot size={22} className="text-[#F5B700]" />
          }
          {badge && !open && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#F5B700] rounded-full text-black text-[9px] font-black flex items-center justify-center leading-none">
              IA
            </span>
          )}
        </button>
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  )
}
