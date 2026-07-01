'use client'
import { useState } from 'react'
import { X, Send, MessageCircle } from 'lucide-react'

export function FloatingChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([
    { from: 'bot', text: 'Olá! Sou a assistente da ViralizaHost. Como posso ajudar? 😊' },
  ])
  const [input, setInput] = useState('')
  const [badge, setBadge] = useState(true)

  const handleOpen = () => {
    setOpen(true)
    setBadge(false)
  }

  const handleSend = () => {
    const text = input.trim()
    if (!text) return
    setMessages(prev => [
      ...prev,
      { from: 'user', text },
      { from: 'bot', text: 'Obrigada pelo contacto! Um agente irá responder em breve. ⚡' },
    ])
    setInput('')
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Chat window */}
      {open && (
        <div className="w-80 bg-white rounded-3xl shadow-[0_16px_64px_rgba(0,0,0,0.18)] border border-[#E8E8E8] overflow-hidden flex flex-col animate-fade-in">
          {/* Header */}
          <div className="bg-[#0A0A0A] px-4 py-3.5 flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-[#F5B700] flex items-center justify-center text-lg">
                👩‍💼
              </div>
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-[#0A0A0A] rounded-full" />
            </div>
            <div className="flex-1">
              <p className="text-white font-bold text-sm">Assistente ViralizaHost</p>
              <p className="text-green-400 text-xs">Online agora</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 p-4 space-y-3 max-h-64 overflow-y-auto bg-[#FAFAFA]">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  msg.from === 'user'
                    ? 'bg-[#0A0A0A] text-white rounded-br-sm'
                    : 'bg-white border border-[#E8E8E8] text-[#333] rounded-bl-sm shadow-sm'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-[#F0F0F0] flex gap-2 bg-white">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Escreva aqui..."
              className="flex-1 text-sm px-3.5 py-2.5 rounded-xl border border-[#E8E8E8] outline-none focus:border-[#F5B700] transition-colors text-[#0A0A0A] placeholder:text-[#BBB]"
            />
            <button
              onClick={handleSend}
              className="w-10 h-10 bg-[#F5B700] hover:bg-[#E0A800] rounded-xl flex items-center justify-center transition-colors shrink-0"
            >
              <Send size={15} className="text-black" />
            </button>
          </div>
        </div>
      )}

      {/* Trigger button */}
      <button
        onClick={handleOpen}
        className="relative w-14 h-14 bg-[#0A0A0A] hover:bg-[#1A1A1A] rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.28)] flex items-center justify-center transition-all hover:scale-105"
        aria-label="Abrir chat"
      >
        {open ? (
          <X size={22} className="text-white" />
        ) : (
          <MessageCircle size={22} className="text-[#F5B700]" />
        )}
        {badge && !open && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-white text-[10px] font-black flex items-center justify-center">
            1
          </span>
        )}
      </button>
    </div>
  )
}
