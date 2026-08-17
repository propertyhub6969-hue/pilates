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
  drop_in_price: number
  admin_whatsapp?: string | null
  bulanan_open_days_before: number
  bulanan_open_time: string
  dropin_open_days_before: number
  dropin_open_time: string
  booking_close_days_before: number
  booking_close_time: string
  default_capacity: number
  min_bulanan: number
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
      drop_in_price: Number(f.drop_in_price ?? 0),
      admin_whatsapp: f.admin_whatsapp || null,
      bulanan_open_days_before: Number(f.bulanan_open_days_before ?? 2),
      bulanan_open_time: f.bulanan_open_time || '20:00',
      dropin_open_days_before: Number(f.dropin_open_days_before ?? 1),
      dropin_open_time: f.dropin_open_time || '20:00',
      booking_close_days_before: Number(f.booking_close_days_before ?? 0),
      booking_close_time: f.booking_close_time || '00:00',
      default_capacity: Number(f.default_capacity ?? 14),
      min_bulanan: Number(f.min_bulanan ?? 10),
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
          <div><label className="label">No. WhatsApp Admin <span className="text-copper-600">· terima notifikasi</span></label>
            <input className="input" value={f.admin_whatsapp ?? ''} onChange={(e) => setF({ ...f, admin_whatsapp: e.target.value })} placeholder="08123456789" />
            <p className="text-[11px] text-ink/40 mt-1">Nomor ini dapat notif WhatsApp saat member mengirim bukti transfer.</p></div>
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
          <div>
            <label className="label">Harga tiket drop-in / per datang (Rp)</label>
            <input className="input" type="number" min={0} value={f.drop_in_price ?? 0}
              onChange={(e) => setF({ ...f, drop_in_price: Number(e.target.value) })} placeholder="75000" />
            <p className="text-[11px] text-ink/40 mt-1">Harga 1 tiket (1 sesi) untuk member "Per Datang". Wajib lunas sebelum bisa booking.</p>
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="font-semibold">Jendela booking berjenjang</h2>
          <p className="text-[11px] text-ink/45 -mt-2">Kapan booking dibuka/ditutup, dihitung dari tanggal kelas. Semua waktu WITA. H-2 = dua hari sebelum kelas.</p>
          <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
            <div><label className="label">Bulanan &amp; Private dibuka — H-</label>
              <input className="input" type="number" min={0} value={f.bulanan_open_days_before ?? 2}
                onChange={(e) => setF({ ...f, bulanan_open_days_before: Number(e.target.value) })} /></div>
            <div><label className="label">pukul</label>
              <input className="input !w-28" type="time" value={f.bulanan_open_time ?? '20:00'}
                onChange={(e) => setF({ ...f, bulanan_open_time: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
            <div><label className="label">Per-datang dibuka — H-</label>
              <input className="input" type="number" min={0} value={f.dropin_open_days_before ?? 1}
                onChange={(e) => setF({ ...f, dropin_open_days_before: Number(e.target.value) })} /></div>
            <div><label className="label">pukul</label>
              <input className="input !w-28" type="time" value={f.dropin_open_time ?? '20:00'}
                onChange={(e) => setF({ ...f, dropin_open_time: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
            <div><label className="label">Booking ditutup — H-</label>
              <input className="input" type="number" min={0} value={f.booking_close_days_before ?? 0}
                onChange={(e) => setF({ ...f, booking_close_days_before: Number(e.target.value) })} /></div>
            <div><label className="label">pukul</label>
              <input className="input !w-28" type="time" value={f.booking_close_time ?? '00:00'}
                onChange={(e) => setF({ ...f, booking_close_time: e.target.value })} /></div>
          </div>
          <p className="text-[11px] text-ink/40">Default: bulanan H-2 20:00, per-datang H-1 20:00, tutup H-0 00:00 (tengah malam masuk hari kelas).</p>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Kapasitas maks / sesi</label>
              <input className="input" type="number" min={1} value={f.default_capacity ?? 14}
                onChange={(e) => setF({ ...f, default_capacity: Number(e.target.value) })} />
              <p className="text-[11px] text-ink/40 mt-1">Dipakai untuk kelas baru.</p></div>
            <div><label className="label">Target min bulanan</label>
              <input className="input" type="number" min={0} value={f.min_bulanan ?? 10}
                onChange={(e) => setF({ ...f, min_bulanan: Number(e.target.value) })} />
              <p className="text-[11px] text-ink/40 mt-1">Ambang "sesi sepi" (dipakai nanti).</p></div>
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
