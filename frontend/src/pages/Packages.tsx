import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/services/api'
import type { Package, Page } from '@/types'
import { formatRupiah } from '@/utils/format'
import Modal from '@/components/Modal'
import { Plus, Pencil, Archive, Infinity as InfinityIcon, Loader2 } from 'lucide-react'

interface FormState {
  id?: string
  name: string
  description: string
  is_unlimited: boolean
  session_count: string
  price: string
  renewal_discount: string
  upgrade_price: string
  validity_days: string
  monthly_expiry: boolean
  is_active: boolean
  is_popular: boolean
}

const EMPTY: FormState = {
  name: '', description: '', is_unlimited: false,
  session_count: '', price: '', renewal_discount: '', upgrade_price: '', validity_days: '', monthly_expiry: false, is_active: true, is_popular: false,
}

export default function Packages() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [error, setError] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['packages'],
    queryFn: async () => (await api.get<Page<Package>>('/packages')).data,
  })

  const save = useMutation({
    mutationFn: async (f: FormState) => {
      const body = {
        name: f.name.trim(),
        description: f.description || null,
        is_unlimited: f.is_unlimited,
        session_count: f.is_unlimited ? null : Number(f.session_count),
        price: Number(f.price),
        renewal_discount: f.renewal_discount ? Number(f.renewal_discount) : 0,
        upgrade_price: f.upgrade_price ? Number(f.upgrade_price) : 0,
        validity_days: f.monthly_expiry ? null : (f.validity_days ? Number(f.validity_days) : null),
        monthly_expiry: f.monthly_expiry,
        is_active: f.is_active,
        is_popular: f.is_popular,
      }
      if (f.id) return (await api.patch(`/packages/${f.id}`, body)).data
      return (await api.post('/packages', body)).data
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['packages'] }); setOpen(false) },
    onError: (e: any) => setError(e?.response?.data?.detail ?? 'Gagal menyimpan'),
  })

  const archive = useMutation({
    mutationFn: async (id: string) => api.delete(`/packages/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['packages'] }),
  })

  function openNew() { setForm(EMPTY); setError(''); setOpen(true) }
  function openEdit(p: Package) {
    setForm({
      id: p.id, name: p.name, description: p.description ?? '',
      is_unlimited: p.is_unlimited, session_count: p.session_count?.toString() ?? '',
      price: p.price.toString(), renewal_discount: (p.renewal_discount ?? 0) ? p.renewal_discount!.toString() : '',
      upgrade_price: (p.upgrade_price ?? 0) ? p.upgrade_price!.toString() : '',
      validity_days: p.validity_days?.toString() ?? '',
      monthly_expiry: p.monthly_expiry ?? false,
      is_active: p.is_active,
      is_popular: p.is_popular ?? false,
    })
    setError(''); setOpen(true)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Paket</h1>
          <p className="text-ink/50 text-sm">Katalog paket yang dijual studio.</p>
        </div>
        <button onClick={openNew} className="btn-primary"><Plus size={16} /> Tambah</button>
      </div>

      {isLoading ? (
        <div className="text-ink/40 py-10 text-center">Memuat…</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.items.map((p) => (
            <div key={p.id} className={`card ${!p.is_active ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between">
                <h3 className="font-semibold text-ink flex items-center gap-2">{p.name}
                  {p.is_popular && <span className="text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 bg-copper-600 text-white">Populer</span>}
                </h3>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(p)} className="btn-ghost !px-2 !py-1.5" title="Ubah"><Pencil size={15} /></button>
                  {p.is_active && (
                    <button onClick={() => archive.mutate(p.id)} className="btn-ghost !px-2 !py-1.5" title="Arsipkan"><Archive size={15} /></button>
                  )}
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2 text-sm text-ink/60">
                {p.is_unlimited ? (
                  <span className="inline-flex items-center gap-1"><InfinityIcon size={15} /> Unlimited</span>
                ) : (
                  <span>{p.session_count} sesi</span>
                )}
                {p.monthly_expiry ? <span className="text-xs rounded-full px-2 py-0.5 bg-copper-50 text-copper-700 border border-copper-100">Bulanan · akhir bulan</span>
                  : p.validity_days ? <span>· berlaku {p.validity_days} hari</span> : null}
              </div>
              {p.description && <p className="text-sm text-ink/50 mt-1">{p.description}</p>}
              <div className="mt-3 font-display text-xl font-semibold text-copper-700">{formatRupiah(p.price)}</div>
              {!p.is_active && <span className="text-xs text-clay">Diarsipkan</span>}
            </div>
          ))}
          {data?.items.length === 0 && (
            <div className="text-ink/40 col-span-full text-center py-10">Belum ada paket. Tambahkan yang pertama.</div>
          )}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={form.id ? 'Ubah Paket' : 'Tambah Paket'}>
        <form
          onSubmit={(e) => { e.preventDefault(); setError(''); save.mutate(form) }}
          className="space-y-4"
        >
          <div>
            <label className="label">Nama paket</label>
            <input className="input" required value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="mis. 10 Sesi Reformer" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_unlimited}
              onChange={(e) => setForm({ ...form, is_unlimited: e.target.checked })} />
            Paket unlimited (tanpa batas sesi)
          </label>
          {!form.is_unlimited && (
            <div>
              <label className="label">Jumlah sesi</label>
              <input className="input" type="number" min={1} required value={form.session_count}
                onChange={(e) => setForm({ ...form, session_count: e.target.value })} placeholder="10" />
            </div>
          )}
          <label className={`flex items-start gap-2 text-sm ${!form.monthly_expiry && form.validity_days ? 'opacity-50' : ''}`}>
            <input type="checkbox" className="mt-1" checked={form.monthly_expiry}
              disabled={!form.monthly_expiry && !!form.validity_days}
              onChange={(e) => setForm({ ...form, monthly_expiry: e.target.checked, validity_days: e.target.checked ? '' : form.validity_days })} />
            <span>Paket <b>bulanan</b> <span className="text-ink/50">— kedaluwarsa akhir bulan pembayaran; sisa sesi diakumulasi bila perpanjang sebelum habis, hangus bila telat. Reminder WA H-1.</span></span>
          </label>
          {!form.monthly_expiry && form.validity_days && <p className="text-[11px] text-ink/40 -mt-2">Kosongkan "Masa berlaku (hari)" dulu untuk memakai mode bulanan.</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Harga (Rp)</label>
              <input className="input" type="number" min={0} required value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="1500000" />
            </div>
            <div>
              <label className="label">Masa berlaku (hari)</label>
              <input className="input disabled:opacity-50" type="number" min={1} value={form.monthly_expiry ? '' : form.validity_days}
                disabled={form.monthly_expiry}
                onChange={(e) => setForm({ ...form, validity_days: e.target.value })} placeholder={form.monthly_expiry ? 'akhir bulan' : '60'} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Diskon perpanjangan (Rp)</label>
              <input className="input" type="number" min={0} value={form.renewal_discount}
                onChange={(e) => setForm({ ...form, renewal_discount: e.target.value })} placeholder="0 (mis. 50000)" />
            </div>
            <div>
              <label className="label">Harga upgrade (Rp)</label>
              <input className="input" type="number" min={0} value={form.upgrade_price}
                onChange={(e) => setForm({ ...form, upgrade_price: e.target.value })} placeholder="0 (mis. 300000)" />
            </div>
          </div>
          <p className="text-[11px] text-ink/40 -mt-2"><b>Diskon perpanjangan</b>: potongan saat member perpanjang paket SAMA yang belum expired. <b>Harga upgrade</b>: harga flat (ganti harga normal) saat member yang <b>sudah pernah bayar & belum pegang paket ini</b> naik ke paket ini. 0 = tak ada.</p>
          <div>
            <label className="label">Deskripsi (opsional)</label>
            <textarea className="input" rows={2} value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <label className="flex items-start gap-2 text-sm border-t border-sand pt-4">
            <input type="checkbox" className="mt-1" checked={form.is_popular}
              onChange={(e) => setForm({ ...form, is_popular: e.target.checked })} />
            <span>Tandai <b>“Paling Populer”</b> di landing page. <span className="text-ink/50">Kartu paket ini ditonjolkan. Hanya satu paket bisa aktif — menandai ini otomatis melepas paket lain.</span></span>
          </label>
          {error && <div className="text-sm text-clay-dark bg-clay/10 border border-clay/20 rounded-lg px-3 py-2">{error}</div>}
          <button type="submit" disabled={save.isPending} className="btn-primary w-full">
            {save.isPending && <Loader2 size={16} className="animate-spin" />} Simpan
          </button>
        </form>
      </Modal>
    </div>
  )
}
