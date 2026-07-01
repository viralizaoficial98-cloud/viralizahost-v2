'use client'
import { useState } from 'react'
import { X, Send, MessageCircle, Phone } from 'lucide-react'

const WHATSAPP_NUMBER = '244923000000'
const WHATSAPP_MSG = encodeURIComponent('Olá! Vim pelo site da ViralizaHost e gostaria de saber mais sobre os planos.')

export function FloatingChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([
    { from: 'bot', text: 'Olá! Sou a assistente da ViralizaHost. Posso ajudar a escolher o plano ideal para o seu negócio? 😊' },
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
      { from: 'bot', text: 'Obrigada pelo contacto! Um especialista irá responder em breve. Ou clique no botão WhatsApp abaixo para atendimento imediato. ⚡' },
    ])
    setInput('')
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="w-[320px] bg-white rounded-3xl shadow-[0_20px_70px_rgba(0,0,0,0.18)] border border-[#E8E8E8] overflow-hidden flex flex-col"
          style={{ animation: 'fadeInUp 0.25s ease' }}>
          {/* Header */}
          <div className="bg-[#0A0A0A] px-4 py-4 flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#F5B700] to-[#E0A800] flex items-center justify-center text-xl shadow-md">
                👩‍💼
              </div>
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-[#0A0A0A] rounded-full" />
            </div>
            <div className="flex-1">
              <p className="text-white font-bold text-sm leading-tight">Assistente ViralizaHost</p>
              <p className="text-green-400 text-xs">Vendas Online · Online agora</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white transition-colors p-1">
              <X size={16} />
            </button>
          </div>

          {/* Messages */}
          <div className="p-4 space-y-3 max-h-56 overflow-y-auto bg-[#FAFAFA]">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.from === 'bot' && (
                  <div className="w-7 h-7 rounded-full bg-[#F5B700]/20 flex items-center justify-center text-sm mr-2 shrink-0 mt-auto">
                    👩‍💼
                  </div>
                )}
                <div className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  msg.from === 'user'
                    ? 'bg-[#0A0A0A] text-white rounded-br-sm'
                    : 'bg-white border border-[#E8E8E8] text-[#333] rounded-bl-sm shadow-sm'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
          </div>

          {/* WhatsApp CTA */}
          <div className="px-4 pt-3 pb-1">
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MSG}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-bold transition-colors"
            >
              <Phone size={14} /> Falar no WhatsApp
            </a>
          </div>

          {/* Input */}
          <div className="p-3 border-t border-[#F0F0F0] flex gap-2 bg-white">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Escreva uma mensagem..."
              className="flex-1 text-sm px-3.5 py-2.5 rounded-xl border border-[#E8E8E8] outline-none focus:border-[#F5B700] transition-colors text-[#0A0A0A] placeholder:text-[#CCC]"
            />
            <button onClick={handleSend}
              className="w-10 h-10 bg-[#F5B700] hover:bg-[#E0A800] rounded-xl flex items-center justify-center transition-colors shrink-0">
              <Send size={14} className="text-black" />
            </button>
          </div>
        </div>
      )}

      {/* Trigger */}
      <div className="flex items-center gap-3">
        {!open && (
          <div className="bg-white border border-[#E8E8E8] rounded-2xl px-3.5 py-2 shadow-lg text-xs font-semibold text-[#0A0A0A] animate-fade-in">
            Vendas Online
          </div>
        )}
        <button onClick={handleOpen}
          className="relative w-14 h-14 bg-[#0A0A0A] hover:bg-[#1A1A1A] rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.28)] flex items-center justify-center transition-all hover:scale-105"
          aria-label="Abrir chat de vendas">
          {open ? <X size={22} className="text-white" /> : <MessageCircle size={22} className="text-[#F5B700]" />}
          {badge && !open && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-white text-[10px] font-black flex items-center justify-center animate-pulse">
              1
            </span>
          )}
        </button>
      </div>
    </div>
  )
}
