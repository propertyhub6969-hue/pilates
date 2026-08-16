import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/services/api'
import type { Branch } from '@/types'
import Modal from '@/components/Modal'
import { Plus, Pencil, Trash2, MapPin, Phone, Loader2, Building2, Star } from 'lucide-react'

interface FormState {
  id?: string
  name: string; address: string; phone: string
  cancellation_window_hours: string; booking_lead_close_hours: string
}
const EMPTY: FormState = { name: '', address: '', phone: '', cancellation_window_hours: '12', booking_lead_close_hours: '0' }

export default function Branches() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [error, setError] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['branches-manage'],
    queryFn: async () => (await api.get<Branch[]>('/branches', { params: { include_inactive: true } })).data,
  })

  const save = useMutation({
    mutationFn: async (f: FormState) => {
      const body = {
        name: f.name.trim(), address: f.address || null, phone: f.phone || null,
        cancellation_window_hours: Number(f.cancellation_window_hours),
        booking_lead_close_hours: Number(f.booking_lead_close_hours),
      }
      if (f.id) return (await api.patch(`/branches/${f.id}`, body)).data
      return (await api.post('/branches', body)).data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branches-manage'] })
      qc.invalidateQueries({ queryKey: ['branches'] })
      setOpen(false)
    },
    onError: (e: any) => setError(e?.response?.data?.detail ?? 'Gagal menyimpan'),
  })
  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/branches/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['branches-manage'] }); qc.invalidateQueries({ queryKey: ['branches'] }) },
    onError: (e: any) => alert(e?.response?.data?.detail ?? 'Gagal menghapus'),
  })

  function openNew() { setForm(EMPTY); setError(''); setOpen(true) }
  function openEdit(b: Branch) {
    setForm({
      id: b.id, name: b.name, address: b.address ?? '', phone: b.phone ?? '',
      cancellation_window_hours: String(b.cancellation_window_hours), booking_lead_close_hours: String(b.booking_lead_close_hours),
    })
    setError(''); setOpen(true)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Cabang</h1>
          <p className="text-ink/50 text-sm">Kelola lokasi studio. Jadwal & booking terpisah per cabang.</p>
        </div>
        <button onClick={openNew} className="btn-primary"><Plus size={16} /> Cabang</button>
      </div>

      {isLoading ? <div className="text-ink/40 py-10 text-center">Memuat…</div> : (
        <div className="grid sm:grid-cols-2 gap-4">
          {data?.map((b) => (
            <div key={b.id} className={`card ${!b.is_active ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="grid place-items-center w-10 h-10 rounded-xl bg-copper-50 text-copper-600 shrink-0"><Building2 size={20} /></span>
                  <div>
                    <div className="font-semibold flex items-center gap-1.5">{b.name}
                      {b.is_default && <span className="inline-flex items-center gap-0.5 text-[10px] text-copper-700 bg-copper-100 rounded-full px-1.5 py-0.5"><Star size={10} /> Utama</span>}
                    </div>
                    {!b.is_active && <span className="text-xs text-clay">non-aktif</span>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(b)} className="btn-ghost !px-2 !py-1.5"><Pencil size={15} /></button>
                  {!b.is_default && <button onClick={() => del.mutate(b.id)} className="btn-ghost !px-2 !py-1.5 text-clay-dark"><Trash2 size={15} /></button>}
                </div>
              </div>
              <div className="mt-3 space-y-1 text-sm text-ink/60">
                {b.address && <div className="flex items-start gap-2"><MapPin size={14} className="mt-0.5 shrink-0" />{b.address}</div>}
                {b.phone && <div className="flex items-center gap-2"><Phone size={14} />{b.phone}</div>}
                <div className="text-xs text-ink/45 pt-1">Batas batal {b.cancellation_window_hours} jam · tutup booking {b.booking_lead_close_hours} jam sebelum</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={form.id ? 'Ubah Cabang' : 'Tambah Cabang'}>
        <form onSubmit={(e) => { e.preventDefault(); setError(''); save.mutate(form) }} className="space-y-4">
          <div><label className="label">Nama cabang</label>
            <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="mis. Cabang Sepinggan" /></div>
          <div><label className="label">Alamat</label>
            <textarea className="input" rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div><label className="label">Telepon / WhatsApp</label>
            <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0542-…" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Batas batal (jam)</label>
              <input className="input" type="number" min={0} value={form.cancellation_window_hours}
                onChange={(e) => setForm({ ...form, cancellation_window_hours: e.target.value })} /></div>
            <div><label className="label">Tutup booking (jam)</label>
              <input className="input" type="number" min={0} value={form.booking_lead_close_hours}
                onChange={(e) => setForm({ ...form, booking_lead_close_hours: e.target.value })} /></div>
          </div>
          {error && <div className="text-sm text-clay-dark bg-clay/10 border border-clay/20 rounded-lg px-3 py-2">{error}</div>}
          <button className="btn-primary w-full" disabled={save.isPending}>
            {save.isPending && <Loader2 size={16} className="animate-spin" />} Simpan
          </button>
        </form>
      </Modal>
    </div>
  )
}
