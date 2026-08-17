import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { api } from '@/services/api'
import type { FinancialAccount, ExpenseRow, ExpenseCategory, AccountType, Page } from '@/types'
import { EXPENSE_CATEGORY_LABEL } from '@/types'
import { formatRupiah, formatDate } from '@/utils/format'
import Modal from '@/components/Modal'
import {
  Plus, Loader2, Trash2, Wallet, Landmark, ChevronLeft, ChevronRight, Pencil,
} from 'lucide-react'

const todayISO = () => new Date().toISOString().slice(0, 10)
const PAGE_SIZE = 15
const CATS: ExpenseCategory[] = ['sewa', 'gaji', 'utilitas', 'peralatan', 'perlengkapan', 'marketing', 'kebersihan', 'lainnya']

function useAccounts() {
  return useQuery({
    queryKey: ['fin-accounts'],
    queryFn: async () => (await api.get<FinancialAccount[]>('/finance/accounts', { params: { include_inactive: true } })).data,
  })
}

export default function Keuangan() {
  const [tab, setTab] = useState<'pengeluaran' | 'akun'>('pengeluaran')
  return (
    <div>
      <h1 className="font-display text-2xl font-semibold mb-5">Keuangan</h1>
      <div className="sticky top-16 z-10 bg-cream border-b border-sand py-3 -mx-4 px-4 lg:-mx-8 lg:px-8">
        <div className="flex gap-2">
          {(['pengeluaran', 'akun'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                tab === t ? 'bg-copper-600 text-white' : 'bg-sand text-ink/60 hover:bg-copper-100'}`}>
              {t === 'pengeluaran' ? 'Pengeluaran' : 'Akun Kas & Bank'}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3">{tab === 'pengeluaran' ? <ExpensesTab /> : <AccountsTab />}</div>
    </div>
  )
}

/* ─────────── PENGELUARAN ─────────── */
function ExpensesTab() {
  const qc = useQueryClient()
  const { data: accounts } = useAccounts()
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [f, setF] = useState({ expense_date: todayISO(), category: 'sewa' as ExpenseCategory, amount: '', account_id: '', description: '' })

  useEffect(() => { setPage(1) }, [])

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['expenses', page],
    queryFn: async () => (await api.get<Page<ExpenseRow>>('/finance/expenses', { params: { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE } })).data,
    placeholderData: keepPreviousData,
  })

  const save = useMutation({
    mutationFn: async () => api.post('/finance/expenses', {
      expense_date: f.expense_date, category: f.category, amount: Number(f.amount),
      account_id: f.account_id, description: f.description || null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); qc.invalidateQueries({ queryKey: ['fin-accounts'] }); setOpen(false) },
    onError: (e: any) => setError(e?.response?.data?.detail ?? 'Gagal menyimpan'),
  })
  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/finance/expenses/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); qc.invalidateQueries({ queryKey: ['fin-accounts'] }) },
  })

  function openNew() {
    setError('')
    setF({ expense_date: todayISO(), category: 'sewa', amount: '', account_id: accounts?.[0]?.id ?? '', description: '' })
    setOpen(true)
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-4">
      <button onClick={openNew} className="btn-primary"><Plus size={16} /> Catat Pengeluaran</button>

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
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? <tr><td colSpan={6} className="px-4 py-10 text-center text-ink/40">Memuat…</td></tr>
                : (data?.items.length ?? 0) === 0 ? <tr><td colSpan={6} className="px-4 py-10 text-center text-ink/40">Belum ada pengeluaran.</td></tr>
                : data!.items.map((e) => (
                  <tr key={e.id} className="border-b border-sand/60 last:border-0 hover:bg-sand/40 transition">
                    <td className="px-4 py-3 text-ink/60 whitespace-nowrap">{formatDate(e.expense_date)}</td>
                    <td className="px-4 py-3"><span className="text-xs rounded-full px-2 py-0.5 bg-copper-50 text-copper-700 border border-copper-100">{EXPENSE_CATEGORY_LABEL[e.category]}</span></td>
                    <td className="px-4 py-3 text-ink/60 hidden md:table-cell">{e.description || '—'}</td>
                    <td className="px-4 py-3 text-ink/60 hidden sm:table-cell">{e.account_name || '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold whitespace-nowrap text-clay-dark">{formatRupiah(e.amount)}</td>
                    <td className="px-2"><button onClick={() => { if (confirm('Hapus pengeluaran ini?')) del.mutate(e.id) }} className="btn-ghost !px-2 !py-1.5 text-clay-dark"><Trash2 size={15} /></button></td>
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

      <Modal open={open} onClose={() => setOpen(false)} title="Catat Pengeluaran">
        <form onSubmit={(e) => { e.preventDefault(); setError(''); save.mutate() }} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Tanggal</label><input type="date" className="input" required value={f.expense_date} onChange={(e) => setF({ ...f, expense_date: e.target.value })} /></div>
            <div><label className="label">Kategori</label>
              <select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as ExpenseCategory })}>
                {CATS.map((c) => <option key={c} value={c}>{EXPENSE_CATEGORY_LABEL[c]}</option>)}
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
    </div>
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
