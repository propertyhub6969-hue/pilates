import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '@/services/api'
import { waLink } from '@/utils/format'
import type { Page, User, MemberCategory } from '@/types'
import { CATEGORY_SHORT } from '@/types'
import Modal from '@/components/Modal'
import { Plus, Search, ChevronRight, Loader2, UserRound, ChevronLeft, MessageCircle, Infinity as InfinityIcon } from 'lucide-react'

type Tab = 'all' | 'bulanan' | 'private' | 'per_datang' | 'instructor'
const PAGE_SIZE = 15
const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'Semua' },
  { key: 'bulanan', label: 'Bulanan' },
  { key: 'private', label: 'Private' },
  { key: 'per_datang', label: 'Per Datang' },
  { key: 'instructor', label: 'Instruktur' },
]

export default function Members() {
  const qc = useQueryClient()
  const nav = useNavigate()
  const [tab, setTab] = useState<Tab>('all')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '', category: 'bulanan' as MemberCategory })

  const isMemberTab = tab !== 'instructor'
  const role = tab === 'instructor' ? 'instructor' : 'member'
  const category = tab === 'all' || tab === 'instructor' ? undefined : tab

  useEffect(() => { setPage(1) }, [tab, q])

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['users', role, category, q, page],
    queryFn: async () =>
      (await api.get<Page<User>>('/members', {
        params: { role, category, q: q || undefined, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE },
      })).data,
    placeholderData: keepPreviousData,
  })

  const create = useMutation({
    mutationFn: async () =>
      (await api.post('/members', {
        full_name: form.full_name, email: form.email.trim().toLowerCase(), phone: form.phone, password: form.password,
        role, ...(isMemberTab ? { member_category: form.category } : {}),
      })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      setOpen(false); setForm({ full_name: '', email: '', phone: '', password: '', category: 'bulanan' })
    },
    onError: (e: any) => setError(e?.response?.data?.detail ?? 'Gagal menyimpan'),
  })

  function openAdd() {
    setError('')
    setForm({ full_name: '', email: '', phone: '', password: '', category: (category ?? 'bulanan') as MemberCategory })
    setOpen(true)
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const fromN = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const toN = Math.min(page * PAGE_SIZE, total)
  const cols = isMemberTab ? 7 : 5

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-2xl font-semibold">Orang</h1>
        <button onClick={openAdd} className="btn-primary">
          <Plus size={16} /> Tambah {isMemberTab ? 'Member' : 'Instruktur'}
        </button>
      </div>

      {/* Tab kategori + pencarian (sticky) */}
      <div className="sticky top-16 z-10 bg-cream border-b border-sand py-3 -mx-4 px-4 lg:-mx-8 lg:px-8 space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-0.5">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition ${
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

      <div className="card !p-0 overflow-hidden mt-3">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink/45 text-xs uppercase tracking-wide border-b border-sand">
                <th className="font-semibold px-4 py-3">Nama</th>
                <th className="font-semibold px-4 py-3 hidden sm:table-cell">Email</th>
                <th className="font-semibold px-4 py-3 hidden md:table-cell">No. WhatsApp</th>
                {isMemberTab && <th className="font-semibold px-4 py-3">Kategori</th>}
                {isMemberTab && <th className="font-semibold px-4 py-3">Sisa Sesi</th>}
                <th className="font-semibold px-4 py-3">Status</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={cols} className="px-4 py-10 text-center text-ink/40">Memuat…</td></tr>
              ) : (data?.items.length ?? 0) === 0 ? (
                <tr><td colSpan={cols} className="px-4 py-10 text-center text-ink/40">
                  {q ? 'Tidak ada hasil.' : 'Belum ada data di kategori ini.'}
                </td></tr>
              ) : (
                data!.items.map((u) => (
                  <tr key={u.id} onClick={() => nav(`/member/${u.id}`)}
                    className="border-b border-sand/60 last:border-0 hover:bg-sand/40 cursor-pointer transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="grid place-items-center w-9 h-9 rounded-full bg-copper-100 text-copper-700 shrink-0"><UserRound size={16} /></span>
                        <div className="min-w-0">
                          <div className="font-semibold text-ink truncate">{u.full_name}</div>
                          <div className="text-xs text-ink/45 truncate sm:hidden">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink/60 hidden sm:table-cell">{u.email}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {u.phone
                        ? <a href={waLink(u.phone)!} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                            className="text-copper-700 hover:underline inline-flex items-center gap-1.5"><MessageCircle size={14} />{u.phone}</a>
                        : <span className="text-ink/30">—</span>}
                    </td>
                    {isMemberTab && (
                      <td className="px-4 py-3">
                        {u.member_category
                          ? <span className="text-xs rounded-full px-2 py-0.5 bg-copper-50 text-copper-700 border border-copper-100">{CATEGORY_SHORT[u.member_category]}</span>
                          : <span className="text-ink/30 text-xs">—</span>}
                      </td>
                    )}
                    {isMemberTab && (
                      <td className="px-4 py-3">
                        {u.has_unlimited
                          ? <span className="inline-flex items-center gap-1 text-copper-700 font-semibold"><InfinityIcon size={15} /></span>
                          : <span className="font-semibold">{u.active_sessions_remaining ?? 0}</span>}
                      </td>
                    )}
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

        <div className="flex items-center justify-between px-4 py-3 border-t border-sand text-sm">
          <div className="text-ink/50 flex items-center gap-2">
            {total > 0 ? <>Menampilkan {fromN}–{toN} dari {total}</> : 'Tidak ada data'}
            {isFetching && <Loader2 size={13} className="animate-spin text-ink/30" />}
          </div>
          <div className="flex items-center gap-1">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn-ghost !px-2 !py-1.5 disabled:opacity-30"><ChevronLeft size={16} /></button>
            <span className="text-ink/60 px-2">{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="btn-ghost !px-2 !py-1.5 disabled:opacity-30"><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={`Tambah ${isMemberTab ? 'Member' : 'Instruktur'}`}>
        <form onSubmit={(e) => { e.preventDefault(); setError(''); create.mutate() }} className="space-y-4">
          <div>
            <label className="label">Nama lengkap</label>
            <input className="input" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          {isMemberTab && (
            <div>
              <label className="label">Kategori member</label>
              <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as MemberCategory })}>
                <option value="bulanan">Bulanan</option>
                <option value="private">Private Training</option>
                <option value="per_datang">Per Datang</option>
              </select>
            </div>
          )}
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="label">No. WhatsApp {isMemberTab && <span className="text-copper-600">· untuk pengingat kelas</span>}</label>
            <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="08123456789" />
            {isMemberTab && <p className="text-[11px] text-ink/40 mt-1">Reminder H-1 kelas dikirim ke nomor ini via WhatsApp.</p>}
          </div>
          <div>
            <label className="label">Password awal</label>
            <input className="input" type="text" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="min. 6 karakter" />
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
