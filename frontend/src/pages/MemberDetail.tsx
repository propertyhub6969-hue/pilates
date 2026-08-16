import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '@/services/api'
import type { MemberDetail as TDetail, Package, Page, PaymentMethod } from '@/types'
import { STATUS_LABEL, PAY_STATUS_LABEL, METHOD_LABEL, ROLE_LABEL } from '@/types'
import { formatRupiah, formatDate, formatDateTime } from '@/utils/format'
import Modal from '@/components/Modal'
import {
  ArrowLeft, Plus, Loader2, Snowflake, Infinity as InfinityIcon,
  Wallet, ShoppingBag, Phone, Mail,
} from 'lucide-react'

const STATUS_STYLE: Record<string, string> = {
  active: 'bg-sage-100 text-sage-700',
  used_up: 'bg-sand text-ink/50',
  expired: 'bg-sand text-ink/50',
  frozen: 'bg-clay/10 text-clay-dark',
  cancelled: 'bg-sand text-ink/40',
}

export default function MemberDetail() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [sale, setSale] = useState<{ package_id: string; price_paid: string; method: PaymentMethod; mark_paid: boolean }>(
    { package_id: '', price_paid: '', method: 'cash', mark_paid: true },
  )

  const { data: m, isLoading } = useQuery({
    queryKey: ['member', id],
    queryFn: async () => (await api.get<TDetail>(`/members/${id}`)).data,
  })
  const { data: packages } = useQuery({
    queryKey: ['packages', 'active'],
    queryFn: async () => (await api.get<Page<Package>>('/packages', { params: { active_only: true } })).data,
  })

  const purchase = useMutation({
    mutationFn: async () => {
      const body: any = { package_id: sale.package_id, method: sale.method, mark_paid: sale.mark_paid }
      if (sale.price_paid) body.price_paid = Number(sale.price_paid)
      return (await api.post(`/members/${id}/purchase`, body)).data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['member', id] })
      setOpen(false); setSale({ package_id: '', price_paid: '', method: 'cash', mark_paid: true })
    },
    onError: (e: any) => setError(e?.response?.data?.detail ?? 'Gagal menyimpan'),
  })

  const freeze = useMutation({
    mutationFn: async (mpId: string) => api.post(`/members/${id}/packages/${mpId}/freeze`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['member', id] }),
  })

  if (isLoading || !m) return <div className="text-ink/40 py-10 text-center">Memuat…</div>

  return (
    <div className="space-y-5">
      <button onClick={() => nav(-1)} className="btn-ghost !px-2 -ml-2 text-ink/60"><ArrowLeft size={18} /> Kembali</button>

      {/* Profil + ringkasan kuota */}
      <div className="card">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl font-semibold">{m.full_name}</h1>
              <span className="text-xs bg-sand rounded-full px-2 py-0.5 text-ink/60">{ROLE_LABEL[m.role]}</span>
              {!m.is_active && <span className="text-xs text-clay">non-aktif</span>}
            </div>
            <div className="mt-2 text-sm text-ink/60 flex flex-wrap gap-x-4 gap-y-1">
              <span className="inline-flex items-center gap-1"><Mail size={14} />{m.email}</span>
              {m.phone && <span className="inline-flex items-center gap-1"><Phone size={14} />{m.phone}</span>}
              {m.join_date && <span>Bergabung {formatDate(m.join_date)}</span>}
            </div>
          </div>
          <div className="rounded-xl2 bg-sage-50 border border-sage-100 px-5 py-3 text-center">
            <div className="text-xs text-ink/50">Sisa kuota</div>
            <div className="font-display text-2xl font-semibold text-sage-700">
              {m.has_unlimited ? <span className="inline-flex items-center gap-1"><InfinityIcon size={22} /></span> : (m.active_sessions_remaining ?? 0)}
            </div>
          </div>
        </div>
        {m.role === 'member' && (
          <button onClick={() => { setError(''); setOpen(true) }} className="btn-primary mt-4"><Plus size={16} /> Jual Paket</button>
        )}
      </div>

      {/* Paket */}
      <div>
        <h2 className="font-display text-lg font-semibold mb-2 flex items-center gap-2"><ShoppingBag size={18} /> Paket</h2>
        <div className="space-y-2">
          {m.packages.map((p) => (
            <div key={p.id} className="card flex items-center gap-3">
              <div className="flex-1">
                <div className="font-semibold">{p.package_name}</div>
                <div className="text-xs text-ink/50">
                  Beli {formatDate(p.purchased_at)}{p.expires_at ? ` · s/d ${formatDate(p.expires_at)}` : ''} · {formatRupiah(p.price_paid)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold">
                  {p.is_unlimited ? <InfinityIcon size={16} className="inline" /> : `${p.sessions_remaining}/${p.sessions_total}`}
                </div>
                <span className={`text-[11px] rounded-full px-2 py-0.5 ${STATUS_STYLE[p.status]}`}>{STATUS_LABEL[p.status]}</span>
              </div>
              {(p.status === 'active' || p.status === 'frozen') && (
                <button onClick={() => freeze.mutate(p.id)} className="btn-ghost !px-2 !py-1.5"
                  title={p.status === 'frozen' ? 'Aktifkan' : 'Bekukan'}>
                  <Snowflake size={15} className={p.status === 'frozen' ? 'text-clay' : 'text-ink/40'} />
                </button>
              )}
            </div>
          ))}
          {m.packages.length === 0 && <div className="text-ink/40 text-sm py-4 text-center">Belum ada paket.</div>}
        </div>
      </div>

      {/* Pembayaran */}
      <div>
        <h2 className="font-display text-lg font-semibold mb-2 flex items-center gap-2"><Wallet size={18} /> Riwayat Pembayaran</h2>
        <div className="space-y-2">
          {m.payments.map((p) => (
            <div key={p.id} className="card flex items-center justify-between">
              <div>
                <div className="font-semibold">{formatRupiah(p.amount)}</div>
                <div className="text-xs text-ink/50">{formatDateTime(p.created_at)} · {METHOD_LABEL[p.method]}</div>
              </div>
              <span className={`text-[11px] rounded-full px-2 py-0.5 ${p.status === 'paid' ? 'bg-sage-100 text-sage-700' : p.status === 'pending' ? 'bg-clay/10 text-clay-dark' : 'bg-sand text-ink/50'}`}>
                {PAY_STATUS_LABEL[p.status]}
              </span>
            </div>
          ))}
          {m.payments.length === 0 && <div className="text-ink/40 text-sm py-4 text-center">Belum ada pembayaran.</div>}
        </div>
      </div>

      {/* Modal jual paket */}
      <Modal open={open} onClose={() => setOpen(false)} title="Jual Paket">
        <form onSubmit={(e) => { e.preventDefault(); setError(''); purchase.mutate() }} className="space-y-4">
          <div>
            <label className="label">Paket</label>
            <select className="input" required value={sale.package_id}
              onChange={(e) => setSale({ ...sale, package_id: e.target.value })}>
              <option value="" disabled>Pilih paket…</option>
              {packages?.items.map((p) => (
                <option key={p.id} value={p.id}>{p.name} — {formatRupiah(p.price)}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Harga bayar</label>
              <input className="input" type="number" min={0} value={sale.price_paid}
                onChange={(e) => setSale({ ...sale, price_paid: e.target.value })} placeholder="default harga paket" />
            </div>
            <div>
              <label className="label">Metode</label>
              <select className="input" value={sale.method}
                onChange={(e) => setSale({ ...sale, method: e.target.value as PaymentMethod })}>
                {(['cash', 'transfer', 'qris', 'card', 'other'] as PaymentMethod[]).map((mth) => (
                  <option key={mth} value={mth}>{METHOD_LABEL[mth]}</option>
                ))}
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={sale.mark_paid}
              onChange={(e) => setSale({ ...sale, mark_paid: e.target.checked })} />
            Sudah lunas (jika tidak, dicatat sebagai menunggu)
          </label>
          {error && <div className="text-sm text-clay-dark bg-clay/10 border border-clay/20 rounded-lg px-3 py-2">{error}</div>}
          <button type="submit" disabled={purchase.isPending} className="btn-primary w-full">
            {purchase.isPending && <Loader2 size={16} className="animate-spin" />} Simpan
          </button>
        </form>
      </Modal>
    </div>
  )
}
