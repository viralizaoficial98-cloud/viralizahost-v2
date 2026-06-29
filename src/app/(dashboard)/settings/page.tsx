'use client'

import { Metadata } from 'next'
import { useState, useEffect } from 'react'
import { User, Lock, Bell, Globe, Save, Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function SettingsPage() {
  const supabase = createClient()
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [showPwd, setShowPwd] = useState(false)
  const [newPwd, setNewPwd] = useState('')
  const [form, setForm] = useState({ full_name: '', phone: '', country: '', currency: 'USD' })

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      supabase.from('profiles').select('*').eq('id', user.id).single().then(({ data: rawData }) => {
        const data = rawData as any
        if (data) {
          setProfile(data)
          setForm({ full_name: data.full_name ?? '', phone: data.phone ?? '', country: data.country ?? 'AO', currency: data.currency ?? 'USD' })
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

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-black text-white">Definições</h1>
        <p className="text-gray-500 text-sm mt-1">Gerencie o seu perfil e preferências</p>
      </div>

      {msg && (
        <div className={`px-4 py-3 rounded-xl text-sm font-medium ${msg.type === 'ok' ? 'bg-green-400/10 text-green-400 border border-green-400/20' : 'bg-red-400/10 text-red-400 border border-red-400/20'}`}>
          {msg.text}
        </div>
      )}

      <div className="glass-dark rounded-2xl border border-[#222] p-6 space-y-5">
        <div className="flex items-center gap-2 mb-2">
          <User size={16} className="text-yellow-400" />
          <h2 className="font-bold text-white">Perfil</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-600 mb-1.5 block">Nome completo</label>
            <input className="input-brand w-full" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Seu nome" />
          </div>
          <div>
            <label className="text-xs text-gray-600 mb-1.5 block">Telefone</label>
            <input className="input-brand w-full" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+244 900 000 000" />
          </div>
          <div>
            <label className="text-xs text-gray-600 mb-1.5 block">País</label>
            <select className="input-brand w-full" value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))}>
              <option value="AO">Angola</option>
              <option value="BR">Brasil</option>
              <option value="PT">Portugal</option>
              <option value="US">Estados Unidos</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-600 mb-1.5 block">Moeda preferida</label>
            <select className="input-brand w-full" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
              <option value="USD">USD — Dólar</option>
              <option value="BRL">BRL — Real</option>
              <option value="AKZ">AKZ — Kwanza</option>
            </select>
          </div>
        </div>
        <div className="pt-2">
          <label className="text-xs text-gray-600 mb-1.5 block">Email</label>
          <input className="input-brand w-full opacity-60 cursor-not-allowed" value={profile?.email ?? ''} disabled />
          <p className="text-xs text-gray-700 mt-1">O email não pode ser alterado aqui.</p>
        </div>
        <button onClick={saveProfile} disabled={saving} className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-60">
          <Save size={14} /> {saving ? 'A guardar...' : 'Guardar Perfil'}
        </button>
      </div>

      <div className="glass-dark rounded-2xl border border-[#222] p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Lock size={16} className="text-yellow-400" />
          <h2 className="font-bold text-white">Segurança</h2>
        </div>
        <div>
          <label className="text-xs text-gray-600 mb-1.5 block">Nova senha</label>
          <div className="relative">
            <input
              type={showPwd ? 'text' : 'password'}
              className="input-brand w-full pr-10"
              value={newPwd}
              onChange={e => setNewPwd(e.target.value)}
              placeholder="Mínimo 8 caracteres"
            />
            <button type="button" onClick={() => setShowPwd(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400">
              {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <button onClick={changePassword} disabled={saving || !newPwd} className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-60">
          <Lock size={14} /> Alterar Senha
        </button>
      </div>
    </div>
  )
}
