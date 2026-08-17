import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { api } from '@/services/api'
import type { FinancialAccount, ExpenseRow, ExpenseEditRow, ExpenseCategoryRow, LedgerResponse, ExpenseCategory, AccountType, Page } from '@/types'
import { EXPENSE_CATEGORY_LABEL, isOwner } from '@/types'
import { useAuth } from '@/context/AuthContext'
import { formatRupiah, formatDate } from '@/utils/format'
import Modal from '@/components/Modal'
import {
  Plus, Loader2, Trash2, Wallet, Landmark, ChevronLeft, ChevronRight, Pencil, History, UserRound,
  Printer, ArrowDownLeft, ArrowUpRight, Sheet, Tags, Power, Check, X,
} from 'lucide-react'

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

const todayISO = () => new Date().toISOString().slice(0, 10)
const firstOfMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10) }
const PAGE_SIZE = 15

function useAccounts() {
  return useQuery({
    queryKey: ['fin-accounts'],
    queryFn: async () => (await api.get<FinancialAccount[]>('/finance/accounts', { params: { include_inactive: true } })).data,
  })
}

function useCategories(includeInactive = false) {
  return useQuery({
    queryKey: ['expense-categories', includeInactive],
    queryFn: async () => (await api.get<ExpenseCategoryRow[]>('/finance/expense-categories', { params: { include_inactive: includeInactive } })).data,
  })
}

// label kategori: pakai daftar dari API, fallback ke label bawaan / key mentah
function catLabel(cats: ExpenseCategoryRow[] | undefined, key: string): string {
  return cats?.find((c) => c.key === key)?.label ?? EXPENSE_CATEGORY_LABEL[key] ?? key
}

const TAB_LABEL: Record<'pengeluaran' | 'akun' | 'ledger', string> = {
  pengeluaran: 'Pengeluaran', akun: 'Akun Kas & Bank', ledger: 'Buku Besar',
}

export default function Keuangan() {
  const { user } = useAuth()
  const owner = isOwner(user?.role)
  const [tab, setTab] = useState<'pengeluaran' | 'akun' | 'ledger'>('pengeluaran')
  const tabs = owner ? (['pengeluaran', 'akun', 'ledger'] as const) : (['pengeluaran', 'akun'] as const)
  return (
    <div>
      <h1 className="font-display text-2xl font-semibold mb-5">Keuangan</h1>
      <div className="sticky top-16 z-10 bg-cream border-b border-sand py-3 -mx-4 px-4 lg:-mx-8 lg:px-8">
        <div className="flex gap-2 flex-wrap">
          {tabs.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                tab === t ? 'bg-copper-600 text-white' : 'bg-sand text-ink/60 hover:bg-copper-100'}`}>
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3">
        {tab === 'pengeluaran' ? <ExpensesTab /> : tab === 'akun' ? <AccountsTab /> : <LedgerTab />}
      </div>
    </div>
  )
}

/* ─────────── PENGELUARAN ─────────── */
function ExpensesTab() {
  const qc = useQueryClient()
  const { data: accounts } = useAccounts()
  const { data: categories } = useCategories()
  const [page, setPage] = useState(1)
  const [range, setRange] = useState({ from: firstOfMonth(), to: todayISO() })
  const [open, setOpen] = useState(false)
  const [catOpen, setCatOpen] = useState(false)
  const [error, setError] = useState('')
  const [histId, setHistId] = useState<string | null>(null)
  const [f, setF] = useState<{ id?: string; expense_date: string; category: ExpenseCategory; amount: string; account_id: string; description: string }>({ expense_date: todayISO(), category: '', amount: '', account_id: '', description: '' })

  useEffect(() => { setPage(1) }, [range.from, range.to])

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['expenses', page, range],
    queryFn: async () => (await api.get<Page<ExpenseRow>>('/finance/expenses', { params: { from: range.from, to: range.to, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE } })).data,
    placeholderData: keepPreviousData,
  })

  const { data: history, isLoading: histLoading } = useQuery({
    queryKey: ['expense-history', histId],
    enabled: !!histId,
    queryFn: async () => (await api.get<ExpenseEditRow[]>(`/finance/expenses/${histId}/history`)).data,
  })

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        expense_date: f.expense_date, category: f.category, amount: Number(f.amount),
        account_id: f.account_id, description: f.description || null,
      }
      if (f.id) return api.patch(`/finance/expenses/${f.id}`, body)
      return api.post('/finance/expenses', body)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); qc.invalidateQueries({ queryKey: ['fin-accounts'] }); setOpen(false) },
    onError: (e: any) => setError(e?.response?.data?.detail ?? 'Gagal menyimpan'),
  })
  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/finance/expenses/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); qc.invalidateQueries({ queryKey: ['fin-accounts'] }) },
  })

  const [downloading, setDownloading] = useState(false)
  async function downloadExcel() {
    setDownloading(true)
    try {
      const res = await api.get('/finance/expenses.xlsx', { params: { from: range.from, to: range.to }, responseType: 'blob' })
      const url = URL.createObjectURL(res.data as Blob)
      const a = document.createElement('a'); a.href = url; a.download = `Pengeluaran_${todayISO()}.xlsx`
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
    } catch { alert('Gagal mengunduh Excel.') }
    finally { setDownloading(false) }
  }

  function openNew() {
    setError('')
    setF({ expense_date: todayISO(), category: categories?.[0]?.key ?? 'lainnya', amount: '', account_id: accounts?.[0]?.id ?? '', description: '' })
    setOpen(true)
  }
  function openEdit(e: ExpenseRow) {
    setError('')
    setF({ id: e.id, expense_date: e.expense_date, category: e.category, amount: String(e.amount), account_id: e.account_id ?? '', description: e.description ?? '' })
    setOpen(true)
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <button onClick={openNew} className="btn-primary"><Plus size={16} /> Catat Pengeluaran</button>
        <button onClick={() => setCatOpen(true)} className="btn-ghost border border-sand"><Tags size={16} /> Kelola Kategori</button>
        <button onClick={downloadExcel} disabled={downloading || (data?.total ?? 0) === 0} className="btn-ghost border border-sand">
          {downloading ? <Loader2 size={16} className="animate-spin" /> : <Sheet size={16} />} Excel
        </button>
      </div>

      <div className="flex gap-2 items-end flex-wrap">
        <div><label className="label">Dari</label><input type="date" className="input" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></div>
        <div><label className="label">Sampai</label><input type="date" className="input" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></div>
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink/45 text-xs uppercase tracking-wide border-b border-sand">
                <th className="font-semibold px-4 py-3">Tanggal</th>
                <th className="font-semibold px-4 py-3">Kategori</th>
                <th className="font-semibold px-4 py-3 hidden md:table-cell">Keterangan</th>
                <th className="font-semibold px-4 py-3 hidden sm:table-cell">Akun</th>
                <th className="font-semibold px-4 py-3 text-right">Jumlah</th>
                <th className="font-semibold px-4 py-3 text-right w-28">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? <tr><td colSpan={6} className="px-4 py-10 text-center text-ink/40">Memuat…</td></tr>
                : (data?.items.length ?? 0) === 0 ? <tr><td colSpan={6} className="px-4 py-10 text-center text-ink/40">Belum ada pengeluaran.</td></tr>
                : data!.items.map((e) => (
                  <tr key={e.id} className="border-b border-sand/60 last:border-0 hover:bg-sand/40 transition">
                    <td className="px-4 py-3 text-ink/60 whitespace-nowrap">{formatDate(e.expense_date)}</td>
                    <td className="px-4 py-3"><span className="text-xs rounded-full px-2 py-0.5 bg-copper-50 text-copper-700 border border-copper-100">{catLabel(categories, e.category)}</span></td>
                    <td className="px-4 py-3 text-ink/60 hidden md:table-cell">{e.description || '—'}</td>
                    <td className="px-4 py-3 text-ink/60 hidden sm:table-cell">{e.account_name || '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold whitespace-nowrap text-clay-dark">{formatRupiah(e.amount)}</td>
                    <td className="px-2">
                      <div className="flex items-center justify-end gap-0.5">
                        <button title="Ubah" onClick={() => openEdit(e)} className="btn-ghost !px-2 !py-1.5 text-ink/55"><Pencil size={15} /></button>
                        <button title="Riwayat edit" onClick={() => setHistId(e.id)} disabled={!e.edit_count}
                          className="btn-ghost !px-2 !py-1.5 relative text-ink/55 disabled:opacity-25">
                          <History size={15} />
                          {e.edit_count > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-0.5 grid place-items-center rounded-full bg-copper-600 text-white text-[9px] font-bold leading-none">{e.edit_count}</span>}
                        </button>
                        <button title="Hapus" onClick={() => { if (confirm('Hapus pengeluaran ini?')) del.mutate(e.id) }} className="btn-ghost !px-2 !py-1.5 text-clay-dark"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-sand text-sm">
          <div className="text-ink/50 flex items-center gap-2">{total} pengeluaran {isFetching && <Loader2 size={13} className="animate-spin text-ink/30" />}</div>
          <div className="flex items-center gap-1">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn-ghost !px-2 !py-1.5 disabled:opacity-30"><ChevronLeft size={16} /></button>
            <span className="text-ink/60 px-2">{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="btn-ghost !px-2 !py-1.5 disabled:opacity-30"><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={f.id ? 'Ubah Pengeluaran' : 'Catat Pengeluaran'}>
        <form onSubmit={(e) => { e.preventDefault(); setError(''); save.mutate() }} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Tanggal</label><input type="date" className="input" required value={f.expense_date} onChange={(e) => setF({ ...f, expense_date: e.target.value })} /></div>
            <div><label className="label">Kategori</label>
              <select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
                {categories?.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div><label className="label">Jumlah (Rp)</label><input type="number" min={1} className="input" required value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder="1000000" /></div>
          <div><label className="label">Dibayar dari akun</label>
            <select className="input" required value={f.account_id} onChange={(e) => setF({ ...f, account_id: e.target.value })}>
              <option value="" disabled>Pilih akun…</option>
              {accounts?.filter((a) => a.is_active).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            {(accounts?.length ?? 0) === 0 && <p className="text-[11px] text-clay-dark mt-1">Buat akun kas/bank dulu di tab "Akun".</p>}
          </div>
          <div><label className="label">Keterangan</label><textarea className="input" rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          {error && <div className="text-sm text-clay-dark bg-clay/10 border border-clay/20 rounded-lg px-3 py-2">{error}</div>}
          <button className="btn-primary w-full" disabled={save.isPending || !f.account_id}>{save.isPending && <Loader2 size={16} className="animate-spin" />} Simpan</button>
        </form>
      </Modal>

      <Modal open={!!histId} onClose={() => setHistId(null)} title="Riwayat Edit">
        {histLoading ? (
          <div className="text-ink/40 py-8 text-center text-sm">Memuat…</div>
        ) : (history?.length ?? 0) === 0 ? (
          <div className="text-ink/40 py-8 text-center text-sm">Belum ada perubahan.</div>
        ) : (
          <ol className="space-y-3">
            {history!.map((h) => (
              <li key={h.id} className="relative pl-6 border-l-2 border-sand">
                <span className="absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-copper-500 border-2 border-white" />
                <div className="flex items-center gap-1.5 text-sm font-semibold text-ink/80">
                  <UserRound size={13} className="text-copper-600" /> {h.edited_by_name || 'Pengguna'}
                </div>
                <div className="text-[11px] text-ink/45 mb-1">{fmtDateTime(h.created_at)}</div>
                <div className="text-sm text-ink/70 whitespace-pre-line">{h.summary || '—'}</div>
              </li>
            ))}
          </ol>
        )}
      </Modal>

      <CategoriesModal open={catOpen} onClose={() => setCatOpen(false)} />
    </div>
  )
}

/* ─────────── KELOLA KATEGORI ─────────── */
function CategoriesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const { data: cats, isLoading } = useCategories(true)
  const [newLabel, setNewLabel] = useState('')
  const [editing, setEditing] = useState<{ id: string; label: string } | null>(null)
  const [err, setErr] = useState('')

  const invalidate = () => { qc.invalidateQueries({ queryKey: ['expense-categories'] }); qc.invalidateQueries({ queryKey: ['expenses'] }) }
  const add = useMutation({
    mutationFn: async () => api.post('/finance/expense-categories', { label: newLabel.trim() }),
    onSuccess: () => { setNewLabel(''); setErr(''); invalidate() },
    onError: (e: any) => setErr(e?.response?.data?.detail ?? 'Gagal menambah'),
  })
  const rename = useMutation({
    mutationFn: async (v: { id: string; label: string }) => api.patch(`/finance/expense-categories/${v.id}`, { label: v.label }),
    onSuccess: () => { setEditing(null); setErr(''); invalidate() },
    onError: (e: any) => setErr(e?.response?.data?.detail ?? 'Gagal menyimpan'),
  })
  const toggle = useMutation({
    mutationFn: async (v: { id: string; is_active: boolean }) => api.patch(`/finance/expense-categories/${v.id}`, { is_active: v.is_active }),
    onSuccess: () => { setErr(''); invalidate() },
    onError: (e: any) => setErr(e?.response?.data?.detail ?? 'Gagal mengubah'),
  })
  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/finance/expense-categories/${id}`),
    onSuccess: () => { setErr(''); invalidate() },
    onError: (e: any) => setErr(e?.response?.data?.detail ?? 'Gagal menghapus'),
  })

  return (
    <Modal open={open} onClose={onClose} title="Kelola Kategori Pengeluaran">
      <div className="space-y-4">
        <form onSubmit={(e) => { e.preventDefault(); if (newLabel.trim()) add.mutate() }} className="flex gap-2">
          <input className="input flex-1" placeholder="Nama kategori baru (mis. Kopi & Snack)" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
          <button className="btn-primary shrink-0" disabled={add.isPending || !newLabel.trim()}>{add.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Tambah</button>
        </form>
        {err && <div className="text-sm text-clay-dark bg-clay/10 border border-clay/20 rounded-lg px-3 py-2">{err}</div>}

        {isLoading ? <div className="text-ink/40 text-center py-6">Memuat…</div> : (
          <div className="divide-y divide-sand max-h-[50vh] overflow-y-auto">
            {cats?.map((c) => (
              <div key={c.id} className={`flex items-center gap-2 py-2.5 ${!c.is_active ? 'opacity-50' : ''}`}>
                {editing?.id === c.id ? (
                  <form className="flex items-center gap-2 flex-1" onSubmit={(e) => { e.preventDefault(); if (editing.label.trim()) rename.mutate({ id: editing.id, label: editing.label.trim() }) }}>
                    <input className="input flex-1 !py-1.5" value={editing.label} autoFocus onChange={(e) => setEditing({ ...editing, label: e.target.value })} />
                    <button type="submit" className="btn-primary !px-3 !py-1.5 shrink-0" disabled={rename.isPending || !editing.label.trim()}>
                      {rename.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={15} />} Simpan
                    </button>
                    <button type="button" onClick={() => setEditing(null)} className="btn-ghost !px-2 !py-1.5 text-ink/50 shrink-0" title="Batal"><X size={15} /></button>
                  </form>
                ) : (
                  <>
                    <span className="flex-1 text-sm">{c.label} {c.is_builtin && <span className="text-[10px] text-ink/40 bg-sand rounded px-1.5 py-0.5 ml-1">bawaan</span>}{!c.is_active && <span className="text-[10px] text-clay ml-1">nonaktif</span>}</span>
                    <button onClick={() => { setEditing({ id: c.id, label: c.label }); setErr('') }} className="btn-ghost !px-2 !py-1.5 text-ink/55" title="Ubah nama"><Pencil size={14} /></button>
                    {!c.is_builtin && (
                      <button onClick={() => toggle.mutate({ id: c.id, is_active: !c.is_active })} className="btn-ghost !px-2 !py-1.5 text-ink/55" title={c.is_active ? 'Nonaktifkan' : 'Aktifkan'}><Power size={14} /></button>
                    )}
                    {!c.is_builtin && (
                      <button onClick={() => { if (confirm(`Hapus kategori "${c.label}"?`)) del.mutate(c.id) }} className="btn-ghost !px-2 !py-1.5 text-clay-dark" title="Hapus"><Trash2 size={14} /></button>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="text-[11px] text-ink/45">Kategori bawaan tak bisa dihapus/dinonaktifkan, tapi namanya boleh diubah. Kategori yang sudah dipakai pengeluaran sebaiknya dinonaktifkan (bukan dihapus).</p>
      </div>
    </Modal>
  )
}

/* ─────────── AKUN ─────────── */
function AccountsTab() {
  const qc = useQueryClient()
  const { data: accounts, isLoading } = useAccounts()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [f, setF] = useState<{ id?: string; name: string; type: AccountType; bank_name: string; account_number: string; opening_balance: string }>({ name: '', type: 'cash', bank_name: '', account_number: '', opening_balance: '0' })

  const save = useMutation({
    mutationFn: async () => {
      const body = { name: f.name, type: f.type, bank_name: f.bank_name || null, account_number: f.account_number || null, opening_balance: Number(f.opening_balance || 0) }
      if (f.id) return api.patch(`/finance/accounts/${f.id}`, body)
      return api.post('/finance/accounts', body)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fin-accounts'] }); setOpen(false) },
    onError: (e: any) => setError(e?.response?.data?.detail ?? 'Gagal menyimpan'),
  })

  function openNew() { setF({ name: '', type: 'cash', bank_name: '', account_number: '', opening_balance: '0' }); setError(''); setOpen(true) }
  function openEdit(a: FinancialAccount) {
    setF({ id: a.id, name: a.name, type: a.type, bank_name: a.bank_name ?? '', account_number: a.account_number ?? '', opening_balance: String(a.opening_balance) })
    setError(''); setOpen(true)
  }

  return (
    <div className="space-y-4">
      <button onClick={openNew} className="btn-primary"><Plus size={16} /> Tambah Akun</button>
      {isLoading ? <div className="text-ink/40 py-10 text-center">Memuat…</div> : (
        <div className="grid sm:grid-cols-2 gap-4">
          {accounts?.map((a) => (
            <div key={a.id} className={`card ${!a.is_active ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className={`grid place-items-center w-11 h-11 rounded-xl ${a.type === 'cash' ? 'bg-copper-50 text-copper-600' : 'bg-sand text-ink/60'}`}>
                    {a.type === 'cash' ? <Wallet size={22} /> : <Landmark size={22} />}
                  </span>
                  <div>
                    <div className="font-semibold">{a.name}</div>
                    <div className="text-xs text-ink/50">{a.type === 'cash' ? 'Kas / tunai' : `${a.bank_name || 'Bank'}${a.account_number ? ` · ${a.account_number}` : ''}`}</div>
                  </div>
                </div>
                <button onClick={() => openEdit(a)} className="btn-ghost !px-2 !py-1.5"><Pencil size={15} /></button>
              </div>
              <div className="mt-3 text-xs text-ink/45">Saldo saat ini</div>
              <div className="font-display text-2xl font-semibold text-copper-700">{formatRupiah(a.balance)}</div>
              {!a.is_active && <span className="text-xs text-clay">non-aktif</span>}
            </div>
          ))}
          {accounts?.length === 0 && <div className="text-ink/40 col-span-full text-center py-10">Belum ada akun. Tambahkan kas atau rekening bank.</div>}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={f.id ? 'Ubah Akun' : 'Tambah Akun'}>
        <form onSubmit={(e) => { e.preventDefault(); setError(''); save.mutate() }} className="space-y-4">
          <div><label className="label">Nama akun</label><input className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="mis. Kas Studio / Bank BCA" /></div>
          {!f.id && (
            <div><label className="label">Jenis</label>
              <select className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as AccountType })}>
                <option value="cash">Kas / Tunai</option>
                <option value="bank">Rekening Bank</option>
              </select>
            </div>
          )}
          {f.type === 'bank' && (
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Nama bank</label><input className="input" value={f.bank_name} onChange={(e) => setF({ ...f, bank_name: e.target.value })} placeholder="BCA" /></div>
              <div><label className="label">No. rekening</label><input className="input" value={f.account_number} onChange={(e) => setF({ ...f, account_number: e.target.value })} /></div>
            </div>
          )}
          <div><label className="label">Saldo awal (Rp)</label><input type="number" min={0} className="input" value={f.opening_balance} onChange={(e) => setF({ ...f, opening_balance: e.target.value })} /></div>
          {error && <div className="text-sm text-clay-dark bg-clay/10 border border-clay/20 rounded-lg px-3 py-2">{error}</div>}
          <button className="btn-primary w-full" disabled={save.isPending}>{save.isPending && <Loader2 size={16} className="animate-spin" />} Simpan</button>
        </form>
      </Modal>
    </div>
  )
}

/* ─────────── BUKU BESAR ─────────── */
function LedgerTab() {
  const { data: accounts } = useAccounts()
  const [accId, setAccId] = useState('')
  const [range, setRange] = useState({ from: firstOfMonth(), to: todayISO() })

  // pilih akun pertama otomatis begitu daftar akun tersedia
  useEffect(() => {
    if (!accId && accounts && accounts.length) setAccId(accounts.find((a) => a.is_active)?.id ?? accounts[0].id)
  }, [accounts, accId])

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['ledger', accId, range],
    enabled: !!accId,
    queryFn: async () => (await api.get<LedgerResponse>(`/finance/accounts/${accId}/ledger`, { params: { from: range.from, to: range.to } })).data,
    placeholderData: keepPreviousData,
  })

  const [downloading, setDownloading] = useState(false)
  async function downloadExcel() {
    if (!accId) return
    setDownloading(true)
    try {
      const res = await api.get(`/finance/accounts/${accId}/ledger.xlsx`, { params: { from: range.from, to: range.to }, responseType: 'blob' })
      const url = URL.createObjectURL(res.data as Blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `BukuBesar_${(data?.account_name ?? 'akun').replace(/\s+/g, '_')}.xlsx`
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
    } catch { alert('Gagal mengunduh Excel.') }
    finally { setDownloading(false) }
  }

  function printLedger() {
    if (!data) return
    const rows = data.entries.map((e) => `<tr>
      <td>${formatDate(e.date)}</td>
      <td>${e.description}</td>
      <td class="amt in">${e.kind === 'in' ? formatRupiah(e.amount) : ''}</td>
      <td class="amt out">${e.kind === 'out' ? formatRupiah(e.amount) : ''}</td>
      <td class="amt">${formatRupiah(e.balance)}</td></tr>`).join('')
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Buku Besar — ${data.account_name}</title>
<style>*{box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;color:#2A2724;margin:32px;font-size:13px}
h1{font-size:18px;color:#8A5140;margin:0}.muted{color:#888;font-size:12px}
table{width:100%;border-collapse:collapse;margin-top:14px}th,td{padding:6px 8px;text-align:left;border-bottom:1px solid #eee}
th{font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#A9654E}
td.amt{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}td.in{color:#5a7d5a}td.out{color:#A55B3B}
.sum{margin-top:16px;display:flex;gap:24px;flex-wrap:wrap}.sum div{font-size:13px}.sum b{color:#8A5140}
.start td{background:#FBF1EB;font-weight:600}@media print{body{margin:0;padding:20px}}</style></head><body>
<h1>Buku Besar — ${data.account_name}</h1>
<div class="muted">Periode ${formatDate(range.from)} – ${formatDate(range.to)}</div>
<table><thead><tr><th>Tanggal</th><th>Keterangan</th><th style="text-align:right">Masuk</th><th style="text-align:right">Keluar</th><th style="text-align:right">Saldo</th></tr></thead>
<tbody><tr class="start"><td>${formatDate(range.from)}</td><td>Saldo awal periode</td><td></td><td></td><td class="amt">${formatRupiah(data.starting_balance)}</td></tr>
${rows}</tbody></table>
<div class="sum"><div>Total masuk: <b>${formatRupiah(data.total_in)}</b></div><div>Total keluar: <b>${formatRupiah(data.total_out)}</b></div><div>Saldo akhir: <b>${formatRupiah(data.ending_balance)}</b></div></div>
</body></html>`
    const w = window.open('', '_blank', 'width=900,height=1000')
    if (!w) { alert('Popup diblokir browser. Izinkan popup untuk mencetak.'); return }
    w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 300)
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-end flex-wrap">
        <div>
          <label className="label">Akun</label>
          <select className="input" value={accId} onChange={(e) => setAccId(e.target.value)}>
            {accounts?.map((a) => <option key={a.id} value={a.id}>{a.name}{a.is_active ? '' : ' (non-aktif)'}</option>)}
          </select>
        </div>
        <div><label className="label">Dari</label><input type="date" className="input" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></div>
        <div><label className="label">Sampai</label><input type="date" className="input" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></div>
        <button onClick={downloadExcel} disabled={!data || downloading} className="btn-ghost border border-sand">
          {downloading ? <Loader2 size={16} className="animate-spin" /> : <Sheet size={16} />} Excel
        </button>
        <button onClick={printLedger} disabled={!data} className="btn-ghost border border-sand"><Printer size={16} /> Cetak</button>
      </div>

      {!accId ? <div className="text-ink/40 text-center py-10">Belum ada akun. Tambahkan kas/bank dulu.</div>
        : isLoading || !data ? <div className="text-ink/40 text-center py-10">Memuat…</div> : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="card"><div className="text-xs text-ink/50">Saldo awal periode</div><div className="font-display text-lg font-semibold">{formatRupiah(data.starting_balance)}</div></div>
            <div className="card"><div className="text-xs text-ink/50 flex items-center gap-1"><ArrowDownLeft size={13} className="text-copper-600" /> Masuk</div><div className="font-display text-lg font-semibold text-copper-700">{formatRupiah(data.total_in)}</div></div>
            <div className="card"><div className="text-xs text-ink/50 flex items-center gap-1"><ArrowUpRight size={13} className="text-clay-dark" /> Keluar</div><div className="font-display text-lg font-semibold text-clay-dark">{formatRupiah(data.total_out)}</div></div>
            <div className="card bg-copper-50 border-copper-100"><div className="text-xs text-ink/50">Saldo akhir</div><div className="font-display text-lg font-semibold text-copper-700">{formatRupiah(data.ending_balance)}</div></div>
          </div>

          <div className="card !p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-ink/45 text-xs uppercase tracking-wide border-b border-sand">
                    <th className="font-semibold px-4 py-3">Tanggal</th>
                    <th className="font-semibold px-4 py-3">Keterangan</th>
                    <th className="font-semibold px-4 py-3 text-right">Masuk</th>
                    <th className="font-semibold px-4 py-3 text-right">Keluar</th>
                    <th className="font-semibold px-4 py-3 text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-sand/60 bg-copper-50/40">
                    <td className="px-4 py-2.5 text-ink/60 whitespace-nowrap">{formatDate(range.from)}</td>
                    <td className="px-4 py-2.5 text-ink/60 italic" colSpan={3}>Saldo awal periode</td>
                    <td className="px-4 py-2.5 text-right font-semibold whitespace-nowrap">{formatRupiah(data.starting_balance)}</td>
                  </tr>
                  {data.entries.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-ink/40">Tidak ada transaksi di periode ini.</td></tr>
                  ) : data.entries.map((e, i) => (
                    <tr key={i} className="border-b border-sand/60 last:border-0 hover:bg-sand/40 transition">
                      <td className="px-4 py-2.5 text-ink/60 whitespace-nowrap">{formatDate(e.date)}</td>
                      <td className="px-4 py-2.5 text-ink/70">{e.description}</td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap text-copper-700 font-medium">{e.kind === 'in' ? formatRupiah(e.amount) : ''}</td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap text-clay-dark font-medium">{e.kind === 'out' ? formatRupiah(e.amount) : ''}</td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap font-semibold">{formatRupiah(e.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between px-4 py-3 border-t border-sand text-sm">
              <span className="text-ink/50 flex items-center gap-2">{data.entries.length} transaksi {isFetching && <Loader2 size={13} className="animate-spin text-ink/30" />}</span>
              <span className="text-ink/60">Saldo akhir: <b className="text-copper-700">{formatRupiah(data.ending_balance)}</b></span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
