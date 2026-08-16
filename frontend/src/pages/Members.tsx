import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '@/services/api'
import type { Page, User, UserRole } from '@/types'
import Modal from '@/components/Modal'
import { Plus, Search, ChevronRight, Loader2, UserRound } from 'lucide-react'

type Tab = 'member' | 'instructor'

export default function Members() {
  const qc = useQueryClient()
  const nav = useNavigate()
  const [tab, setTab] = useState<Tab>('member')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '' })

  const { data, isLoading } = useQuery({
    queryKey: ['users', tab, q],
    queryFn: async () =>
      (await api.get<Page<User>>('/members', { params: { role: tab, q: q || undefined } })).data,
  })

  const create = useMutation({
    mutationFn: async () =>
      (await api.post('/members', { ...form, email: form.email.trim().toLowerCase(), role: tab })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      setOpen(false); setForm({ full_name: '', email: '', phone: '', password: '' })
    },
    onError: (e: any) => setError(e?.response?.data?.detail ?? 'Gagal menyimpan'),
  })

  const tabs: { key: Tab; label: string }[] = [
    { key: 'member', label: 'Member' },
    { key: 'instructor', label: 'Instruktur' },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">Orang</h1>
        <button onClick={() => { setError(''); setOpen(true) }} className="btn-primary">
          <Plus size={16} /> Tambah {tab === 'member' ? 'Member' : 'Instruktur'}
        </button>
      </div>

      <div className="flex gap-2">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
              tab === t.key ? 'bg-copper-600 text-white' : 'bg-sand text-ink/60 hover:bg-copper-100'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/30" />
        <input className="input pl-9" placeholder="Cari nama, email, atau telepon…"
          value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="text-ink/40 py-10 text-center">Memuat…</div>
      ) : (
        <div className="space-y-2">
          {data?.items.map((u) => (
            <button key={u.id} onClick={() => nav(`/member/${u.id}`)}
              className="w-full card flex items-center gap-3 text-left hover:shadow-card transition">
              <span className="grid place-items-center w-10 h-10 rounded-full bg-copper-100 text-copper-700 shrink-0">
                <UserRound size={18} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-ink truncate">{u.full_name}</div>
                <div className="text-xs text-ink/50 truncate">{u.email}{u.phone ? ` · ${u.phone}` : ''}</div>
              </div>
              {!u.is_active && <span className="text-xs text-clay">non-aktif</span>}
              <ChevronRight size={18} className="text-ink/30" />
            </button>
          ))}
          {data?.items.length === 0 && (
            <div className="text-ink/40 text-center py-10">Belum ada {tab === 'member' ? 'member' : 'instruktur'}.</div>
          )}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={`Tambah ${tab === 'member' ? 'Member' : 'Instruktur'}`}>
        <form onSubmit={(e) => { e.preventDefault(); setError(''); create.mutate() }} className="space-y-4">
          <div>
            <label className="label">Nama lengkap</label>
            <input className="input" required value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" required value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="label">No. WhatsApp {tab === 'member' && <span className="text-copper-600">· untuk pengingat kelas</span>}</label>
            <input className="input" value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="08123456789" />
            {tab === 'member' && <p className="text-[11px] text-ink/40 mt-1">Reminder H-1 kelas dikirim ke nomor ini via WhatsApp.</p>}
          </div>
          <div>
            <label className="label">Password awal</label>
            <input className="input" type="text" required minLength={6} value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="min. 6 karakter" />
          </div>
          {error && <div className="text-sm text-clay-dark bg-clay/10 border border-clay/20 rounded-lg px-3 py-2">{error}</div>}
          <button type="submit" disabled={create.isPending} className="btn-primary w-full">
            {create.isPending && <Loader2 size={16} className="animate-spin" />} Simpan
          </button>
        </form>
      </Modal>
    </div>
  )
}
