import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/services/api'
import type { PayrollRow, FinancialAccount } from '@/types'
import { formatRupiah, formatDate } from '@/utils/format'
import Modal from '@/components/Modal'
import { Loader2, Banknote, Trash2, Pencil, Wallet, CheckCircle2 } from 'lucide-react'

const todayISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date())
const thisMonth = () => todayISO().slice(0, 7)

function monthLabel(period: string) {
  const [y, m] = period.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
}

export default function Payroll() {
  const qc = useQueryClient()
  const [period, setPeriod] = useState(thisMonth())
  const [payFor, setPayFor] = useState<PayrollRow | null>(null)
  const [editFor, setEditFor] = useState<PayrollRow | null>(null)

  const { data: accounts } = useQuery({
    queryKey: ['fin-accounts'],
    queryFn: async () => (await api.get<FinancialAccount[]>('/finance/accounts', { params: { include_inactive: true } })).data,
  })
  const activeAccts = accounts?.filter((a) => a.is_active) ?? []

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['payroll', period],
    queryFn: async () => (await api.get<PayrollRow[]>('/employees/payroll', { params: { period } })).data,
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['payroll'] })
    qc.invalidateQueries({ queryKey: ['fin-accounts'] })
    qc.invalidateQueries({ queryKey: ['expenses'] })
  }

  const generate = useMutation({
    mutationFn: async () => api.post('/employees/payroll/generate', { period }),
    onSuccess: invalidate,
    onError: (e: any) => alert(e?.response?.data?.detail ?? 'Gagal membuat payroll'),
  })
  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/employees/payroll/${id}`),
    onSuccess: invalidate,
  })

  const rows = data ?? []
  const totalDraft = rows.filter((r) => r.status === 'draft').reduce((s, r) => s + r.amount, 0)
  const totalPaid = rows.filter((r) => r.status === 'paid').reduce((s, r) => s + r.amount, 0)
  const hasDraft = rows.some((r) => r.status === 'draft')

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="font-display text-2xl font-semibold">Payroll</h1>
        <div className="flex items-end gap-2">
          <div><label className="label !mb-1 text-xs">Periode</label>
            <input type="month" className="input !py-1.5" value={period} onChange={(e) => setPeriod(e.target.value)} />
          </div>
          <button onClick={() => generate.mutate()} disabled={generate.isPending} className="btn-primary">
            {generate.isPending ? <Loader2 size={16} className="animate-spin" /> : <Banknote size={16} />} Buat Payroll
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="card"><div className="text-xs text-ink/50">Belum dibayar (draft)</div><div className="font-display text-xl font-semibold text-clay-dark">{formatRupiah(totalDraft)}</div></div>
        <div className="card"><div className="text-xs text-ink/50">Sudah dibayar</div><div className="font-display text-xl font-semibold text-emerald-700">{formatRupiah(totalPaid)}</div></div>
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink/45 text-xs uppercase tracking-wide border-b border-sand">
                <th className="font-semibold px-4 py-3">Karyawan</th>
                <th className="font-semibold px-4 py-3 text-right">Jumlah</th>
                <th className="font-semibold px-4 py-3">Status</th>
                <th className="font-semibold px-4 py-3 hidden sm:table-cell">Dibayar dari / tgl</th>
                <th className="font-semibold px-4 py-3 text-right w-32">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? <tr><td colSpan={5} className="px-4 py-10 text-center text-ink/40">Memuat…</td></tr>
                : rows.length === 0 ? <tr><td colSpan={5} className="px-4 py-10 text-center text-ink/40">
                    Belum ada payroll untuk {monthLabel(period)}. Klik <b>Buat Payroll</b> untuk membuat dari karyawan aktif.
                  </td></tr>
                : rows.map((r) => (
                  <tr key={r.id} className="border-b border-sand/60 last:border-0 hover:bg-sand/40 transition">
                    <td className="px-4 py-3 font-semibold">{r.employee_name}</td>
                    <td className="px-4 py-3 text-right font-medium whitespace-nowrap">{formatRupiah(r.amount)}</td>
                    <td className="px-4 py-3">
                      {r.status === 'paid'
                        ? <span className="inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5 bg-emerald-50 text-emerald-700"><CheckCircle2 size={12} /> Dibayar</span>
                        : <span className="text-xs rounded-full px-2 py-0.5 bg-sand text-ink/60">Draft</span>}
                    </td>
                    <td className="px-4 py-3 text-ink/60 hidden sm:table-cell whitespace-nowrap">
                      {r.status === 'paid' ? <>{r.account_name || '—'}{r.paid_date ? ` · ${formatDate(r.paid_date)}` : ''}</> : '—'}
                    </td>
                    <td className="px-2">
                      <div className="flex items-center justify-end gap-0.5">
                        {r.status === 'draft' ? (
                          <>
                            <button title="Ubah jumlah" onClick={() => setEditFor(r)} className="btn-ghost !px-2 !py-1.5 text-ink/55"><Pencil size={15} /></button>
                            <button onClick={() => setPayFor(r)} className="btn-primary !px-3 !py-1.5 text-xs"><Wallet size={13} /> Bayar</button>
                          </>
                        ) : (
                          <button title="Hapus (batalkan pembayaran)" onClick={() => { if (confirm('Hapus payroll ini? Pengeluaran gaji terkait ikut terhapus.')) del.mutate(r.id) }} className="btn-ghost !px-2 !py-1.5 text-clay-dark"><Trash2 size={15} /></button>
                        )}
                        {r.status === 'draft' && (
                          <button title="Hapus" onClick={() => { if (confirm('Hapus baris payroll ini?')) del.mutate(r.id) }} className="btn-ghost !px-2 !py-1.5 text-clay-dark"><Trash2 size={15} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-sand text-sm text-ink/50 flex items-center gap-2">
          {rows.length} baris · {monthLabel(period)} {isFetching && <Loader2 size={13} className="animate-spin text-ink/30" />}
        </div>
      </div>

      <p className="text-xs text-ink/45">Saat <b>Bayar</b>, gaji otomatis tercatat sebagai Pengeluaran kategori <b>Gaji</b> di Keuangan (masuk laba/rugi & buku besar akun). Menghapus payroll yang sudah dibayar akan menghapus pengeluaran itu juga.</p>

      {payFor && <PayModal row={payFor} accounts={activeAccts} onClose={() => setPayFor(null)} onDone={() => { setPayFor(null); invalidate() }} />}
      {editFor && <EditModal row={editFor} onClose={() => setEditFor(null)} onDone={() => { setEditFor(null); invalidate() }} />}
    </div>
  )
}

function PayModal({ row, accounts, onClose, onDone }: { row: PayrollRow; accounts: FinancialAccount[]; onClose: () => void; onDone: () => void }) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [paidDate, setPaidDate] = useState(todayISO())
  const [error, setError] = useState('')
  const pay = useMutation({
    mutationFn: async () => api.post(`/employees/payroll/${row.id}/pay`, { account_id: accountId, paid_date: paidDate }),
    onSuccess: onDone,
    onError: (e: any) => setError(e?.response?.data?.detail ?? 'Gagal membayar'),
  })
  return (
    <Modal open onClose={onClose} title={`Bayar Gaji — ${row.employee_name}`}>
      <form onSubmit={(e) => { e.preventDefault(); setError(''); if (accountId) pay.mutate() }} className="space-y-4">
        <div className="card bg-sand/40 !py-3"><div className="text-xs text-ink/50">Jumlah</div><div className="font-display text-xl font-semibold text-copper-700">{formatRupiah(row.amount)}</div></div>
        <div><label className="label">Dibayar dari akun</label>
          <select className="input" required value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="" disabled>Pilih akun…</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          {accounts.length === 0 && <p className="text-[11px] text-clay-dark mt-1">Buat akun kas/bank dulu di Keuangan → Akun.</p>}
        </div>
        <div><label className="label">Tanggal bayar</label><input type="date" className="input" required value={paidDate} onChange={(e) => setPaidDate(e.target.value)} /></div>
        {error && <div className="text-sm text-clay-dark bg-clay/10 border border-clay/20 rounded-lg px-3 py-2">{error}</div>}
        <button className="btn-primary w-full" disabled={pay.isPending || !accountId}>{pay.isPending && <Loader2 size={16} className="animate-spin" />} Bayar & Catat sebagai Pengeluaran</button>
      </form>
    </Modal>
  )
}

function EditModal({ row, onClose, onDone }: { row: PayrollRow; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState(String(row.amount))
  const [note, setNote] = useState(row.note ?? '')
  const [error, setError] = useState('')
  const save = useMutation({
    mutationFn: async () => api.patch(`/employees/payroll/${row.id}`, { amount: Number(amount || 0), note: note || null }),
    onSuccess: onDone,
    onError: (e: any) => setError(e?.response?.data?.detail ?? 'Gagal menyimpan'),
  })
  return (
    <Modal open onClose={onClose} title={`Ubah — ${row.employee_name}`}>
      <form onSubmit={(e) => { e.preventDefault(); setError(''); save.mutate() }} className="space-y-4">
        <div><label className="label">Jumlah (Rp)</label><input type="number" min={0} className="input" required value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        <div><label className="label">Catatan</label><textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>
        {error && <div className="text-sm text-clay-dark bg-clay/10 border border-clay/20 rounded-lg px-3 py-2">{error}</div>}
        <button className="btn-primary w-full" disabled={save.isPending}>{save.isPending && <Loader2 size={16} className="animate-spin" />} Simpan</button>
      </form>
    </Modal>
  )
}
