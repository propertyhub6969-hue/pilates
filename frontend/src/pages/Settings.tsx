import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/services/api'
import { Loader2, Check } from 'lucide-react'

interface StudioSettings {
  id: string
  name: string
  tagline?: string | null
  address?: string | null
  phone?: string | null
  cancellation_window_hours: number
  booking_lead_close_hours: number
}

export default function Settings() {
  const qc = useQueryClient()
  const [f, setF] = useState<Partial<StudioSettings>>({})
  const [saved, setSaved] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['studio-settings'],
    queryFn: async () => (await api.get<StudioSettings>('/studio/settings')).data,
  })
  useEffect(() => { if (data) setF(data) }, [data])

  const save = useMutation({
    mutationFn: async () => (await api.patch('/studio/settings', {
      name: f.name, tagline: f.tagline || null, address: f.address || null, phone: f.phone || null,
      cancellation_window_hours: Number(f.cancellation_window_hours),
      booking_lead_close_hours: Number(f.booking_lead_close_hours),
    })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['studio-settings'] })
      qc.invalidateQueries({ queryKey: ['public-studio'] })
      setSaved(true); setTimeout(() => setSaved(false), 2500)
    },
  })

  if (isLoading) return <div className="text-ink/40 py-10 text-center">Memuat…</div>

  return (
    <div className="max-w-xl space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold">Pengaturan Studio</h1>
        <p className="text-ink/50 text-sm">Identitas &amp; aturan booking. Info ini tampil di halaman publik.</p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); save.mutate() }} className="space-y-5">
        <div className="card space-y-4">
          <h2 className="font-semibold">Identitas</h2>
          <div><label className="label">Nama studio</label>
            <input className="input" value={f.name ?? ''} onChange={(e) => setF({ ...f, name: e.target.value })} required /></div>
          <div><label className="label">Tagline</label>
            <input className="input" value={f.tagline ?? ''} onChange={(e) => setF({ ...f, tagline: e.target.value })} placeholder="mis. Bergerak dengan niat & keseimbangan" /></div>
          <div><label className="label">Alamat</label>
            <textarea className="input" rows={2} value={f.address ?? ''} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>
          <div><label className="label">Telepon / WhatsApp</label>
            <input className="input" value={f.phone ?? ''} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="0812-…" /></div>
        </div>

        <div className="card space-y-4">
          <h2 className="font-semibold">Aturan booking</h2>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Batas batal (jam)</label>
              <input className="input" type="number" min={0} value={f.cancellation_window_hours ?? 12}
                onChange={(e) => setF({ ...f, cancellation_window_hours: Number(e.target.value) })} />
              <p className="text-[11px] text-ink/40 mt-1">Batal lebih awal dari ini → kuota kembali.</p>
            </div>
            <div><label className="label">Tutup booking (jam)</label>
              <input className="input" type="number" min={0} value={f.booking_lead_close_hours ?? 0}
                onChange={(e) => setF({ ...f, booking_lead_close_hours: Number(e.target.value) })} />
              <p className="text-[11px] text-ink/40 mt-1">0 = boleh booking sampai kelas mulai.</p>
            </div>
          </div>
        </div>

        <button className="btn-primary" disabled={save.isPending}>
          {save.isPending ? <Loader2 size={16} className="animate-spin" /> : saved ? <Check size={16} /> : null}
          {saved ? 'Tersimpan' : 'Simpan'}
        </button>
      </form>
    </div>
  )
}
