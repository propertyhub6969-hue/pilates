import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { api } from '@/services/api'
import type { Page, PaymentRow, PaymentStatus } from '@/types'
import { PAY_STATUS_LABEL, METHOD_LABEL } from '@/types'
import { formatRupiah, formatDateTime, formatDate } from '@/utils/format'
import Modal from '@/components/Modal'
import { CheckCircle2, Loader2, ChevronLeft, ChevronRight, ImageIcon, Trash2, Printer } from 'lucide-react'

const PAGE_SIZE = 15

interface Studio { name: string; address?: string | null; phone?: string | null }

// Angka → terbilang (Bahasa Indonesia)
function terbilang(num: number): string {
  const n = Math.floor(Math.abs(num))
  if (n === 0) return 'nol'
  const s = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas']
  const w = (x: number): string => {
    if (x < 12) return s[x]
    if (x < 20) return w(x - 10) + ' belas'
    if (x < 100) return w(Math.floor(x / 10)) + ' puluh' + (x % 10 ? ' ' + w(x % 10) : '')
    if (x < 200) return 'seratus' + (x - 100 ? ' ' + w(x - 100) : '')
    if (x < 1000) return w(Math.floor(x / 100)) + ' ratus' + (x % 100 ? ' ' + w(x % 100) : '')
    if (x < 2000) return 'seribu' + (x - 1000 ? ' ' + w(x - 1000) : '')
    if (x < 1e6) return w(Math.floor(x / 1000)) + ' ribu' + (x % 1000 ? ' ' + w(x % 1000) : '')
    if (x < 1e9) return w(Math.floor(x / 1e6)) + ' juta' + (x % 1e6 ? ' ' + w(x % 1e6) : '')
    return w(Math.floor(x / 1e9)) + ' miliar' + (x % 1e9 ? ' ' + w(x % 1e9) : '')
  }
  return w(n).replace(/\s+/g, ' ').trim()
}

const receiptNo = (p: PaymentRow) => `KW-${new Date(p.created_at).getFullYear()}-${String(p.receipt_no ?? 0).padStart(5, '0')}`
const FILTERS: { key: PaymentStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'Semua' },
  { key: 'paid', label: 'Lunas' },
  { key: 'pending', label: 'Menunggu' },
  { key: 'refunded', label: 'Refund' },
]

function StatusBadge({ s }: { s: PaymentStatus }) {
  const cls = s === 'paid' ? 'bg-copper-100 text-copper-700' : s === 'pending' ? 'bg-clay/10 text-clay-dark' : 'bg-sand text-ink/50'
  return <span className={`text-xs rounded-full px-2 py-0.5 ${cls}`}>{PAY_STATUS_LABEL[s]}</span>
}

export default function Payments() {
  const qc = useQueryClient()
  const [filter, setFilter] = useState<PaymentStatus | 'all'>('all')
  const [page, setPage] = useState(1)

  useEffect(() => { setPage(1) }, [filter])

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['payments', filter, page],
    queryFn: async () =>
      (await api.get<Page<PaymentRow>>('/payments', {
        params: { ...(filter === 'all' ? {} : { status: filter }), limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE },
      })).data,
    placeholderData: keepPreviousData,
  })

  const verify = useMutation({
    mutationFn: async (pid: string) => api.patch(`/payments/${pid}`, { status: 'paid' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payments'] }),
  })
  const del = useMutation({
    mutationFn: async (pid: string) => api.delete(`/payments/${pid}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payments'] }),
    onError: (e: any) => alert(e?.response?.data?.detail ?? 'Gagal menghapus'),
  })

  const { data: studio } = useQuery({
    queryKey: ['studio-settings'],
    queryFn: async () => (await api.get<Studio>('/studio/settings')).data,
  })

  function printReceipt(p: PaymentRow) {
    const nama = studio?.name ?? 'Reformer Your Body'
    const item = p.package_name ?? p.note ?? 'Pembayaran'
    const statusLabel = PAY_STATUS_LABEL[p.status]
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Kuitansi ${receiptNo(p)}</title>
<style>
  *{box-sizing:border-box} body{font-family:'Segoe UI',Arial,sans-serif;color:#2A2724;margin:36px;font-size:14px}
  .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #A9654E;padding-bottom:14px}
  .studio{font-size:20px;font-weight:700;color:#8A5140}.muted{color:#888;font-size:12px}
  .title{font-weight:700;letter-spacing:1px;font-size:16px}
  table{width:100%;border-collapse:collapse;margin-top:20px} td{padding:7px 2px;vertical-align:top}
  td.k{color:#888;width:150px} .amount{margin-top:18px;padding:12px 16px;background:#FBF1EB;border:1px solid #E8C2AF;border-radius:8px}
  .amount .rp{font-size:22px;font-weight:700;color:#8A5140}.amount .tb{font-style:italic;color:#6b6b6b;font-size:13px;text-transform:capitalize}
  .sign{margin-top:48px;text-align:right}.sign .line{margin-top:56px;border-top:1px solid #999;width:200px;display:inline-block}
  .foot{margin-top:24px;font-size:11px;color:#aaa;text-align:center;border-top:1px solid #eee;padding-top:10px}
  @media print{body{margin:0;padding:24px}}
</style></head><body>
  <div class="head">
    <div><div class="studio">${nama}</div>${studio?.address ? `<div class="muted">${studio.address}</div>` : ''}${studio?.phone ? `<div class="muted">${studio.phone}</div>` : ''}</div>
    <div style="text-align:right"><div class="title">KUITANSI</div><div class="muted">No. ${receiptNo(p)}</div><div class="muted">${formatDate(p.created_at)}</div></div>
  </div>
  <table>
    <tr><td class="k">Telah diterima dari</td><td><b>${p.member_name ?? '—'}</b></td></tr>
    <tr><td class="k">Untuk pembayaran</td><td>${item}</td></tr>
    <tr><td class="k">Metode</td><td>${METHOD_LABEL[p.method]}</td></tr>
    <tr><td class="k">Status</td><td>${statusLabel}${p.paid_at ? ` · ${formatDate(p.paid_at)}` : ''}</td></tr>
  </table>
  <div class="amount"><div class="rp">${formatRupiah(p.amount)}</div><div class="tb">${terbilang(p.amount)} rupiah</div></div>
  <div class="sign"><div>Hormat kami,</div><div class="line"></div><div class="muted">${nama}</div></div>
  <div class="foot">Kuitansi ini sah tanpa tanda tangan basah · dicetak ${formatDate(new Date().toISOString())}</div>
</body></html>`
    const wdw = window.open('', '_blank', 'width=760,height=900')
    if (!wdw) { alert('Popup diblokir browser. Izinkan popup untuk mencetak.'); return }
    wdw.document.write(html); wdw.document.close(); wdw.focus(); setTimeout(() => wdw.print(), 300)
  }

  const [proofView, setProofView] = useState<{ url: string; isPdf: boolean } | null>(null)
  const [proofLoading, setProofLoading] = useState<string | null>(null)
  async function viewProof(id: string) {
    setProofLoading(id)
    try {
      const res = await api.get(`/payments/${id}/proof`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      setProofView({ url, isPdf: (res.data as Blob).type === 'application/pdf' })
    } catch { alert('Gagal memuat bukti') } finally { setProofLoading(null) }
  }
  function closeProof() {
    if (proofView) URL.revokeObjectURL(proofView.url)
    setProofView(null)
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, total)

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold mb-5">Pembayaran</h1>

      {/* Filter (sticky) */}
      <div className="sticky top-16 z-10 bg-cream border-b border-sand py-3 -mx-4 px-4 lg:-mx-8 lg:px-8">
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                filter === f.key ? 'bg-copper-600 text-white' : 'bg-sand text-ink/60 hover:bg-copper-100'}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card !p-0 overflow-hidden mt-3">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink/45 text-xs uppercase tracking-wide border-b border-sand">
                <th className="font-semibold px-4 py-3">Tanggal</th>
                <th className="font-semibold px-4 py-3">Member</th>
                <th className="font-semibold px-4 py-3 hidden md:table-cell">Paket</th>
                <th className="font-semibold px-4 py-3 hidden sm:table-cell">Metode</th>
                <th className="font-semibold px-4 py-3 text-right">Jumlah</th>
                <th className="font-semibold px-4 py-3">Bukti</th>
                <th className="font-semibold px-4 py-3">Status</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-ink/40">Memuat…</td></tr>
              ) : (data?.items.length ?? 0) === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-ink/40">Belum ada pembayaran.</td></tr>
              ) : (
                data!.items.map((p) => (
                  <tr key={p.id} className="border-b border-sand/60 last:border-0 hover:bg-sand/40 transition">
                    <td className="px-4 py-3 text-ink/60 whitespace-nowrap">{formatDateTime(p.created_at)}</td>
                    <td className="px-4 py-3 font-semibold text-ink">{p.member_name ?? '—'}</td>
                    <td className="px-4 py-3 text-ink/60 hidden md:table-cell">
                      {p.package_name ?? (p.note?.startsWith('Drop-in')
                        ? <span className="text-xs rounded-full px-2 py-0.5 bg-copper-50 text-copper-700 border border-copper-100">Drop-in</span>
                        : '—')}
                    </td>
                    <td className="px-4 py-3 text-ink/60 hidden sm:table-cell">{METHOD_LABEL[p.method]}</td>
                    <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">{formatRupiah(p.amount)}</td>
                    <td className="px-4 py-3">
                      {p.has_proof
                        ? <button onClick={() => viewProof(p.id)} disabled={proofLoading === p.id}
                            className="inline-flex items-center gap-1 text-xs text-copper-700 hover:underline">
                            {proofLoading === p.id ? <Loader2 size={13} className="animate-spin" /> : <ImageIcon size={14} />} Lihat
                          </button>
                        : <span className="text-ink/30 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3"><StatusBadge s={p.status} /></td>
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        {p.status === 'pending' && (
                          <button onClick={() => verify.mutate(p.id)} disabled={verify.isPending}
                            className="btn-primary !px-2.5 !py-1.5" title="Tandai lunas">
                            {verify.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                          </button>
                        )}
                        <button onClick={() => printReceipt(p)} className="btn-ghost !px-2 !py-1.5 text-ink/55" title="Cetak kuitansi"><Printer size={14} /></button>
                        <button onClick={() => { if (confirm('Hapus pembayaran ini? Tak bisa dibatalkan.')) del.mutate(p.id) }} disabled={del.isPending}
                          className="btn-ghost !px-2 !py-1.5 text-clay-dark" title="Hapus pembayaran"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

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

      <Modal open={!!proofView} onClose={closeProof} title="Bukti Transfer" maxWidth="max-w-2xl">
        {proofView && (proofView.isPdf
          ? <iframe src={proofView.url} className="w-full h-[70vh] rounded-lg border border-sand" title="Bukti" />
          : <img src={proofView.url} alt="Bukti transfer" className="w-full rounded-lg" />)}
      </Modal>
    </div>
  )
}
