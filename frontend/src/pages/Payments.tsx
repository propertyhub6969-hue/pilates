import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/services/api'
import type { Page, PaymentRow, PaymentStatus } from '@/types'
import { PAY_STATUS_LABEL, METHOD_LABEL } from '@/types'
import { formatRupiah, formatDateTime } from '@/utils/format'
import { CheckCircle2, Loader2 } from 'lucide-react'

const FILTERS: { key: PaymentStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'Semua' },
  { key: 'paid', label: 'Lunas' },
  { key: 'pending', label: 'Menunggu' },
  { key: 'refunded', label: 'Refund' },
]

export default function Payments() {
  const qc = useQueryClient()
  const [filter, setFilter] = useState<PaymentStatus | 'all'>('all')

  const { data, isLoading } = useQuery({
    queryKey: ['payments', filter],
    queryFn: async () =>
      (await api.get<Page<PaymentRow>>('/payments', {
        params: filter === 'all' ? {} : { status: filter },
      })).data,
  })

  const verify = useMutation({
    mutationFn: async (pid: string) => api.patch(`/payments/${pid}`, { status: 'paid' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payments'] }),
  })

  const total = data?.items.filter((p) => p.status === 'paid').reduce((s, p) => s + Number(p.amount), 0) ?? 0

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="font-display text-2xl font-semibold">Pembayaran</h1>
        <div className="text-right">
          <div className="text-xs text-ink/50">Total lunas (tampil)</div>
          <div className="font-display text-xl font-semibold text-sage-700">{formatRupiah(total)}</div>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
              filter === f.key ? 'bg-sage-600 text-white' : 'bg-sand text-ink/60 hover:bg-sage-100'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-ink/40 py-10 text-center">Memuat…</div>
      ) : (
        <div className="space-y-2">
          {data?.items.map((p) => (
            <div key={p.id} className="card flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{p.member_name ?? '—'}</div>
                <div className="text-xs text-ink/50 truncate">
                  {p.package_name ?? 'Pembayaran'} · {formatDateTime(p.created_at)} · {METHOD_LABEL[p.method]}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-semibold">{formatRupiah(p.amount)}</div>
                <span className={`text-[11px] rounded-full px-2 py-0.5 ${p.status === 'paid' ? 'bg-sage-100 text-sage-700' : p.status === 'pending' ? 'bg-clay/10 text-clay-dark' : 'bg-sand text-ink/50'}`}>
                  {PAY_STATUS_LABEL[p.status]}
                </span>
              </div>
              {p.status === 'pending' && (
                <button onClick={() => verify.mutate(p.id)} disabled={verify.isPending}
                  className="btn-primary !px-3 !py-1.5" title="Tandai lunas">
                  {verify.isPending ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                </button>
              )}
            </div>
          ))}
          {data?.items.length === 0 && <div className="text-ink/40 text-center py-10">Belum ada pembayaran.</div>}
        </div>
      )}
    </div>
  )
}
