'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { X, Send, Bot, Loader2, ChevronDown } from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const INITIAL_MESSAGE: Message = {
  id: 'welcome',
  role: 'assistant',
  content: 'Olá! Sou o assistente virtual da ViralizaHost. Posso ajudar com planos de hospedagem, domínios, e-mail corporativo e suporte técnico. Como posso ajudar?',
}

export function FloatingChat() {
  const [open, setOpen] = useState(false)
  const [badge, setBadge] = useState(true)
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return
    setError(null)

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setInput('')
    setIsLoading(true)

    // Build payload (exclude the static welcome message from history)
    const history = nextMessages
      .filter(m => m.id !== 'welcome')
      .map(m => ({ role: m.role, content: m.content }))

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, conversationId }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Erro ao contactar o assistente.')
      }

      // Track conversation ID
      const convId = res.headers.get('X-Conversation-Id')
      if (convId && !conversationId) setConversationId(convId)

      // Stream text response
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) throw new Error('Sem stream de resposta.')

      const assistantId = crypto.randomUUID()
      setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }])

      let fullText = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        // toTextStreamResponse returns plain text chunks
        const chunk = decoder.decode(value, { stream: true })
        fullText += chunk
        setMessages(prev =>
          prev.map(m => m.id === assistantId ? { ...m, content: fullText } : m)
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.')
      // Remove the user message that failed
      setMessages(prev => prev.filter(m => m.id !== userMsg.id))
    } finally {
      setIsLoading(false)
    }
  }, [messages, conversationId, isLoading])

  const handleOpen = () => { setOpen(true); setBadge(false) }

  const quickQuestions = [
    'Quais planos têm disponíveis?',
    'Verificar disponibilidade de domínio',
    'Preciso de suporte técnico',
  ]

  const showQuickQuestions = messages.length <= 1 && !isLoading

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <div
          className="w-[340px] bg-white rounded-2xl shadow-[0_20px_70px_rgba(0,0,0,0.22)] border border-[#E8E8E8] overflow-hidden flex flex-col"
          style={{ maxHeight: 'calc(100vh - 120px)', animation: 'slideUp 0.2s ease' }}
        >
          {/* Header */}
          <div className="bg-[#0A0A0A] px-4 py-3.5 flex items-center gap-3 shrink-0">
            <div className="relative shrink-0">
              <div className="w-10 h-10 rounded-full bg-[#F5B700] flex items-center justify-center">
                <Bot size={20} className="text-black" />
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 border-2 border-[#0A0A0A] rounded-full" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm leading-tight">Assistente ViralizaHost</p>
              <p className="text-green-400 text-xs">IA · Disponível 24/7</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-gray-500 hover:text-white transition-colors p-1 shrink-0"
              aria-label="Minimizar chat"
            >
              <ChevronDown size={18} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#FAFAFA]" style={{ minHeight: 200 }}>
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-[#F5B700]/20 border border-[#F5B700]/30 flex items-center justify-center mr-2 shrink-0 mt-auto">
                    <Bot size={13} className="text-[#B08000]" />
                  </div>
                )}
                <div
                  className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
                    msg.role === 'user'
                      ? 'bg-[#0A0A0A] text-white rounded-br-sm'
                      : 'bg-white border border-[#E8E8E8] text-[#222] rounded-bl-sm shadow-sm'
                  }`}
                >
                  {msg.content || (msg.role === 'assistant' && isLoading ? (
                    <Loader2 size={12} className="text-[#F5B700] animate-spin" />
                  ) : null)}
                </div>
              </div>
            ))}

            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex justify-start">
                <div className="w-7 h-7 rounded-full bg-[#F5B700]/20 border border-[#F5B700]/30 flex items-center justify-center mr-2 shrink-0">
                  <Bot size={13} className="text-[#B08000]" />
                </div>
                <div className="bg-white border border-[#E8E8E8] rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                  <Loader2 size={14} className="text-[#F5B700] animate-spin" />
                </div>
              </div>
            )}

            {error && (
              <p className="text-center text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">
                {error}
              </p>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick questions */}
          {showQuickQuestions && (
            <div className="px-3 pt-2 pb-1 flex flex-col gap-1.5 border-t border-[#F0F0F0] bg-white shrink-0">
              {quickQuestions.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-left text-xs px-3 py-2 rounded-xl border border-[#E8E8E8] hover:border-[#F5B700] hover:bg-[#FFFBEE] text-[#444] transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="p-3 border-t border-[#F0F0F0] flex gap-2 bg-white shrink-0">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) } }}
              placeholder="Escreva a sua mensagem..."
              disabled={isLoading}
              className="flex-1 text-sm px-3.5 py-2.5 rounded-xl border border-[#E8E8E8] outline-none focus:border-[#F5B700] transition-colors text-[#0A0A0A] placeholder:text-[#CCC] disabled:opacity-60"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={isLoading || !input.trim()}
              className="w-10 h-10 bg-[#F5B700] hover:bg-[#E0A800] disabled:opacity-50 rounded-xl flex items-center justify-center transition-colors shrink-0"
            >
              <Send size={14} className="text-black" />
            </button>
          </div>
        </div>
      )}

      {/* Trigger */}
      <div className="flex items-center gap-3">
        {!open && (
          <div className="bg-white border border-[#E8E8E8] rounded-2xl px-3.5 py-2 shadow-lg text-xs font-semibold text-[#0A0A0A]">
            Fale com a IA
          </div>
        )}
        <button
          onClick={open ? () => setOpen(false) : handleOpen}
          className="relative w-14 h-14 bg-[#0A0A0A] hover:bg-[#1A1A1A] rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.28)] flex items-center justify-center transition-all hover:scale-105"
          aria-label="Abrir assistente virtual"
        >
          {open ? <X size={22} className="text-white" /> : <Bot size={22} className="text-[#F5B700]" />}
          {badge && !open && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#F5B700] rounded-full text-black text-[9px] font-black flex items-center justify-center">
              IA
            </span>
          )}
        </button>
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
