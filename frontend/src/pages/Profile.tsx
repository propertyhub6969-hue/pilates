import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/services/api'
import { useAuth } from '@/context/AuthContext'
import { ROLE_LABEL } from '@/types'
import Avatar from '@/components/Avatar'
import { Loader2, Check, Camera, Trash2 } from 'lucide-react'

export default function Profile() {
  const { user, refreshUser } = useAuth()
  const [f, setF] = useState({ current_password: '', new_password: '', confirm: '' })
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [photoErr, setPhotoErr] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const uploadPhoto = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      return api.post('/auth/me/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    onSuccess: async () => { setPhotoErr(''); await refreshUser() },
    onError: (e: any) => setPhotoErr(e?.response?.data?.detail ?? 'Gagal mengunggah foto'),
  })
  const removePhoto = useMutation({
    mutationFn: async () => api.delete('/auth/me/avatar'),
    onSuccess: async () => { setPhotoErr(''); await refreshUser() },
  })

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setPhotoErr('Ukuran foto maksimal 5 MB'); return }
    uploadPhoto.mutate(file)
  }

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
        <div className="relative shrink-0">
          <Avatar user={user} size={72} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploadPhoto.isPending}
            title="Ganti foto"
            className="absolute -bottom-1 -right-1 grid place-items-center w-7 h-7 rounded-full bg-copper-600 text-white shadow hover:bg-copper-700 disabled:opacity-60">
            {uploadPhoto.isPending ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
          </button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onPick} />
        </div>
        <div className="min-w-0">
          <div className="font-display text-lg font-semibold truncate">{user?.full_name}</div>
          <div className="text-sm text-ink/50 truncate">{user?.email} · {user && ROLE_LABEL[user.role]}</div>
          <div className="flex items-center gap-3 mt-1.5">
            <button type="button" onClick={() => fileRef.current?.click()} className="text-xs text-copper-700 font-medium hover:underline">Ganti foto</button>
            {user?.avatar_path && (
              <button type="button" onClick={() => removePhoto.mutate()} disabled={removePhoto.isPending}
                className="text-xs text-clay-dark font-medium hover:underline inline-flex items-center gap-1">
                <Trash2 size={12} /> Hapus
              </button>
            )}
          </div>
          {photoErr && <div className="text-xs text-clay-dark mt-1">{photoErr}</div>}
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
