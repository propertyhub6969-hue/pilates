import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '@/services/api'
import type { Page, User, UserRole } from '@/types'
import Modal from '@/components/Modal'
import { Plus, Search, ChevronRight, Loader2, UserRound, ChevronLeft } from 'lucide-react'

type Tab = 'member' | 'instructor'
const PAGE_SIZE = 15

export default function Members() {
  const qc = useQueryClient()
  const nav = useNavigate()
  const [tab, setTab] = useState<Tab>('member')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '' })

  // Reset ke halaman 1 saat ganti tab / pencarian
  useEffect(() => { setPage(1) }, [tab, q])

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['users', tab, q, page],
    queryFn: async () =>
      (await api.get<Page<User>>('/members', {
        params: { role: tab, q: q || undefined, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE },
      })).data,
    placeholderData: keepPreviousData,
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

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, total)
  const tabs: { key: Tab; label: string }[] = [
    { key: 'member', label: 'Member' },
    { key: 'instructor', label: 'Instruktur' },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-2xl font-semibold">Orang</h1>
        <button onClick={() => { setError(''); setOpen(true) }} className="btn-primary">
          <Plus size={16} /> Tambah {tab === 'member' ? 'Member' : 'Instruktur'}
        </button>
      </div>

      {/* Tab + pencarian (sticky) */}
      <div className="sticky top-16 z-10 bg-cream/95 backdrop-blur py-2 -mx-4 px-4 lg:-mx-8 lg:px-8 space-y-3">
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
      </div>

      {/* Tabel */}
      <div className="card !p-0 overflow-hidden mt-3">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink/45 text-xs uppercase tracking-wide border-b border-sand">
                <th className="font-semibold px-4 py-3">Nama</th>
                <th className="font-semibold px-4 py-3 hidden sm:table-cell">Email</th>
                <th className="font-semibold px-4 py-3 hidden md:table-cell">No. WhatsApp</th>
                <th className="font-semibold px-4 py-3">Status</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-ink/40">Memuat…</td></tr>
              ) : (data?.items.length ?? 0) === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-ink/40">
                  {q ? 'Tidak ada hasil.' : `Belum ada ${tab === 'member' ? 'member' : 'instruktur'}.`}
                </td></tr>
              ) : (
                data!.items.map((u) => (
                  <tr key={u.id} onClick={() => nav(`/member/${u.id}`)}
                    className="border-b border-sand/60 last:border-0 hover:bg-sand/40 cursor-pointer transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="grid place-items-center w-9 h-9 rounded-full bg-copper-100 text-copper-700 shrink-0">
                          <UserRound size={16} />
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold text-ink truncate">{u.full_name}</div>
                          <div className="text-xs text-ink/45 truncate sm:hidden">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink/60 hidden sm:table-cell">{u.email}</td>
                    <td className="px-4 py-3 text-ink/60 hidden md:table-cell">{u.phone || <span className="text-ink/30">—</span>}</td>
                    <td className="px-4 py-3">
                      {u.is_active
                        ? <span className="text-xs rounded-full px-2 py-0.5 bg-copper-100 text-copper-700">Aktif</span>
                        : <span className="text-xs rounded-full px-2 py-0.5 bg-sand text-ink/50">Non-aktif</span>}
                    </td>
                    <td className="px-2"><ChevronRight size={16} className="text-ink/30" /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginasi */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-sand text-sm">
          <div className="text-ink/50 flex items-center gap-2">
            {total > 0 ? <>Menampilkan {from}–{to} dari {total}</> : 'Tidak ada data'}
            {isFetching && <Loader2 size={13} className="animate-spin text-ink/30" />}
          </div>
          <div className="flex items-center gap-1">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
              className="btn-ghost !px-2 !py-1.5 disabled:opacity-30"><ChevronLeft size={16} /></button>
            <span className="text-ink/60 px-2">{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
              className="btn-ghost !px-2 !py-1.5 disabled:opacity-30"><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>

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
