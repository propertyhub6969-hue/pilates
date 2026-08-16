import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { api } from '@/services/api'
import type { Page, PaymentRow, PaymentStatus } from '@/types'
import { PAY_STATUS_LABEL, METHOD_LABEL } from '@/types'
import { formatRupiah, formatDateTime } from '@/utils/format'
import { CheckCircle2, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'

const PAGE_SIZE = 15
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
                <th className="font-semibold px-4 py-3">Status</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-ink/40">Memuat…</td></tr>
              ) : (data?.items.length ?? 0) === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-ink/40">Belum ada pembayaran.</td></tr>
              ) : (
                data!.items.map((p) => (
                  <tr key={p.id} className="border-b border-sand/60 last:border-0 hover:bg-sand/40 transition">
                    <td className="px-4 py-3 text-ink/60 whitespace-nowrap">{formatDateTime(p.created_at)}</td>
                    <td className="px-4 py-3 font-semibold text-ink">{p.member_name ?? '—'}</td>
                    <td className="px-4 py-3 text-ink/60 hidden md:table-cell">{p.package_name ?? '—'}</td>
                    <td className="px-4 py-3 text-ink/60 hidden sm:table-cell">{METHOD_LABEL[p.method]}</td>
                    <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">{formatRupiah(p.amount)}</td>
                    <td className="px-4 py-3"><StatusBadge s={p.status} /></td>
                    <td className="px-2 py-3">
                      {p.status === 'pending' && (
                        <button onClick={() => verify.mutate(p.id)} disabled={verify.isPending}
                          className="btn-primary !px-2.5 !py-1.5" title="Tandai lunas">
                          {verify.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                        </button>
                      )}
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
    </div>
  )
}
