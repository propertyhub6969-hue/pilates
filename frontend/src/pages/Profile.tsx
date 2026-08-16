import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/services/api'
import { useAuth } from '@/context/AuthContext'
import { ROLE_LABEL } from '@/types'
import { Loader2, Check, UserRound } from 'lucide-react'

export default function Profile() {
  const { user } = useAuth()
  const [f, setF] = useState({ current_password: '', new_password: '', confirm: '' })
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const change = useMutation({
    mutationFn: async () => api.post('/auth/change-password', {
      current_password: f.current_password, new_password: f.new_password,
    }),
    onSuccess: () => { setMsg({ type: 'ok', text: 'Password berhasil diganti.' }); setF({ current_password: '', new_password: '', confirm: '' }) },
    onError: (e: any) => setMsg({ type: 'err', text: e?.response?.data?.detail ?? 'Gagal mengganti password' }),
  })

  function submit(e: React.FormEvent) {
    e.preventDefault(); setMsg(null)
    if (f.new_password !== f.confirm) { setMsg({ type: 'err', text: 'Konfirmasi password tidak cocok' }); return }
    change.mutate()
  }

  return (
    <div className="max-w-xl space-y-5">
      <h1 className="font-display text-2xl font-semibold">Profil</h1>

      <div className="card flex items-center gap-4">
        <span className="grid place-items-center w-14 h-14 rounded-full bg-copper-100 text-copper-700"><UserRound size={26} /></span>
        <div>
          <div className="font-display text-lg font-semibold">{user?.full_name}</div>
          <div className="text-sm text-ink/50">{user?.email} · {user && ROLE_LABEL[user.role]}</div>
        </div>
      </div>

      <form onSubmit={submit} className="card space-y-4">
        <h2 className="font-semibold">Ganti password</h2>
        <div><label className="label">Password sekarang</label>
          <input className="input" type="password" required value={f.current_password}
            onChange={(e) => setF({ ...f, current_password: e.target.value })} /></div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><label className="label">Password baru</label>
            <input className="input" type="password" required minLength={6} value={f.new_password}
              onChange={(e) => setF({ ...f, new_password: e.target.value })} /></div>
          <div><label className="label">Konfirmasi</label>
            <input className="input" type="password" required value={f.confirm}
              onChange={(e) => setF({ ...f, confirm: e.target.value })} /></div>
        </div>
        {msg && (
          <div className={`text-sm rounded-lg px-3 py-2 ${msg.type === 'ok' ? 'text-copper-700 bg-copper-50 border border-copper-100' : 'text-clay-dark bg-clay/10 border border-clay/20'}`}>
            {msg.text}
          </div>
        )}
        <button className="btn-primary" disabled={change.isPending}>
          {change.isPending ? <Loader2 size={16} className="animate-spin" /> : msg?.type === 'ok' ? <Check size={16} /> : null} Simpan
        </button>
      </form>
    </div>
  )
}
