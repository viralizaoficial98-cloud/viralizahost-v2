'use client'

import { useState, useEffect } from 'react'
import { User, Lock, Save, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react'
import { createAuthClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const inputStyle = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: 12,
  border: '1px solid #E2E8F0',
  background: '#F8FAFC',
  color: '#0B0B0D',
  fontSize: 14,
  outline: 'none',
}

const sectionCard = {
  background: '#FFFFFF',
  border: '1px solid #E5E7EB',
  borderRadius: 18,
  boxShadow: '0 10px 30px rgba(15,23,42,0.06)',
  padding: 24,
}

export default function SettingsPage() {
  const supabase = createAuthClient()
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [showPwd, setShowPwd] = useState(false)
  const [newPwd, setNewPwd] = useState('')
  const [form, setForm] = useState({ full_name: '', phone: '', country: 'AO', currency: 'USD' })

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      supabase.from('profiles').select('*').eq('id', user.id).single().then(({ data }) => {
        const d = data as any
        if (d) {
          setProfile(d)
          setForm({ full_name: d.full_name ?? '', phone: d.phone ?? '', country: d.country ?? 'AO', currency: d.currency ?? 'USD' })
        }
      })
    })
  }, [])

  const saveProfile = async () => {
    if (!profile) return
    setSaving(true); setMsg(null)
    const { error } = await (supabase as any).from('profiles').update({ ...form, updated_at: new Date().toISOString() }).eq('id', profile.id)
    setMsg(error ? { type: 'err', text: error.message } : { type: 'ok', text: 'Perfil atualizado com sucesso!' })
    setSaving(false)
  }

  const changePassword = async () => {
    if (!newPwd || newPwd.length < 8) { setMsg({ type: 'err', text: 'Mínimo 8 caracteres' }); return }
    setSaving(true); setMsg(null)
    const { error } = await supabase.auth.updateUser({ password: newPwd })
    setMsg(error ? { type: 'err', text: error.message } : { type: 'ok', text: 'Senha atualizada!' })
    setNewPwd(''); setSaving(false)
  }

  const field = (label: string, node: React.ReactNode) => (
    <div>
      <label className="block text-xs font-semibold mb-1.5" style={{ color: '#64748B' }}>{label}</label>
      {node}
    </div>
  )

  return (
    <div className="space-y-7 max-w-2xl">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-black" style={{ color: '#0B0B0D' }}>Definições</h1>
        <p className="text-sm mt-1" style={{ color: '#64748B' }}>Gerencie o seu perfil e preferências</p>
      </div>

      {/* Feedback */}
      {msg && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium"
          style={msg.type === 'ok'
            ? { background: 'rgba(16,185,129,0.08)', color: '#059669', border: '1px solid rgba(16,185,129,0.20)' }
            : { background: 'rgba(239,68,68,0.08)', color: '#DC2626', border: '1px solid rgba(239,68,68,0.20)' }}>
          {msg.type === 'ok' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {msg.text}
        </div>
      )}

      {/* Profile card */}
      <div style={sectionCard}>
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(245,183,0,0.10)', border: '1px solid rgba(245,183,0,0.20)' }}>
            <User size={17} style={{ color: '#D9A300' }} />
          </div>
          <div>
            <h2 className="font-bold text-sm" style={{ color: '#0B0B0D' }}>Perfil</h2>
            <p className="text-xs" style={{ color: '#94A3B8' }}>Informações pessoais da sua conta</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          {field('Nome completo',
            <input style={inputStyle} value={form.full_name}
              onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              placeholder="Seu nome completo" />
          )}
          {field('Telefone',
            <input style={inputStyle} value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="+244 900 000 000" />
          )}
          {field('País',
            <select style={inputStyle} value={form.country}
              onChange={e => setForm(f => ({ ...f, country: e.target.value }))}>
              <option value="AO">🇦🇴 Angola</option>
              <option value="BR">🇧🇷 Brasil</option>
              <option value="PT">🇵🇹 Portugal</option>
              <option value="US">🇺🇸 Estados Unidos</option>
            </select>
          )}
          {field('Moeda preferida',
            <select style={inputStyle} value={form.currency}
              onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
              <option value="USD">USD — Dólar Americano</option>
              <option value="BRL">BRL — Real Brasileiro</option>
              <option value="AKZ">AKZ — Kwanza Angolano</option>
            </select>
          )}
        </div>

        {field('Email (não editável)',
          <input style={{ ...inputStyle, opacity: 0.55, cursor: 'not-allowed' }}
            value={profile?.email ?? ''} disabled />
        )}
        <p className="text-xs mt-1 mb-5" style={{ color: '#94A3B8' }}>O email não pode ser alterado por aqui.</p>

        <button onClick={saveProfile} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-black disabled:opacity-60 transition-all"
          style={{ background: 'linear-gradient(135deg,#F5B700,#D9A300)', boxShadow: '0 4px 14px rgba(245,183,0,0.30)' }}>
          <Save size={14} /> {saving ? 'A guardar...' : 'Guardar Perfil'}
        </button>
      </div>

      {/* Security card */}
      <div style={sectionCard}>
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
            <Lock size={17} style={{ color: '#DC2626' }} />
          </div>
          <div>
            <h2 className="font-bold text-sm" style={{ color: '#0B0B0D' }}>Segurança</h2>
            <p className="text-xs" style={{ color: '#94A3B8' }}>Altere a sua senha de acesso</p>
          </div>
        </div>

        {field('Nova senha',
          <div className="relative">
            <input
              type={showPwd ? 'text' : 'password'}
              style={{ ...inputStyle, paddingRight: 40 }}
              value={newPwd}
              onChange={e => setNewPwd(e.target.value)}
              placeholder="Mínimo 8 caracteres"
            />
            <button type="button" onClick={() => setShowPwd(p => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: '#94A3B8' }}>
              {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        )}

        <button onClick={changePassword} disabled={saving || !newPwd}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-black disabled:opacity-60 transition-all mt-5"
          style={{ background: 'linear-gradient(135deg,#F5B700,#D9A300)', boxShadow: '0 4px 14px rgba(245,183,0,0.30)' }}>
          <Lock size={14} /> Alterar Senha
        </button>
      </div>
    </div>
  )
}
