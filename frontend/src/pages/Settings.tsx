import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/services/api'
import { Loader2, Check, Send, RefreshCw, Upload, Trash2, Image as ImageIcon } from 'lucide-react'

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
  wa_broadcast_enabled: boolean
  wa_group_bulanan?: string | null
  booking_url: string
  announcement?: string | null
  announcement_active?: boolean
  member_schedule_start?: string | null
  waitlist_enabled?: boolean
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

  const [wantGroups, setWantGroups] = useState(false)
  const { data: groups, isFetching: groupsLoading } = useQuery({
    queryKey: ['wa-groups'],
    enabled: wantGroups,
    queryFn: async () => (await api.get<{ jid: string; name: string }[]>('/studio/wa-groups')).data,
  })
  const [testMsg, setTestMsg] = useState('')
  async function testBroadcast(kind: 'bulanan' | 'dropin') {
    setTestMsg('Mengirim…')
    try {
      const { data } = await api.post('/schedule/broadcast', { kind })
      setTestMsg(data?.ok ? `✓ ${kind === 'bulanan' ? 'Terkirim ke grup' : `Terkirim ke ${data.sent ?? 0}/${data.total ?? 0} per-datang`} (${data.info ?? ''})` : `Gagal: ${data?.reason ?? data?.info ?? '—'}`)
    } catch (e: any) { setTestMsg('Gagal: ' + (e?.response?.data?.detail ?? 'error')) }
  }

  const save = useMutation({
    mutationFn: async () => (await api.patch('/studio/settings', {
      name: f.name, tagline: f.tagline || null, address: f.address || null, phone: f.phone || null,
      waitlist_enabled: f.waitlist_enabled !== false,
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
      wa_broadcast_enabled: !!f.wa_broadcast_enabled,
      wa_group_bulanan: f.wa_group_bulanan || null,
      booking_url: f.booking_url || 'https://reformeryourbody.com/jadwal',
      announcement: f.announcement || null,
      announcement_active: !!f.announcement_active,
      member_schedule_start: f.member_schedule_start || null,
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

      <LandingPhotos />

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

        <div className="card space-y-3">
          <h2 className="font-semibold">Pengumuman Member</h2>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!f.announcement_active} onChange={(e) => setF({ ...f, announcement_active: e.target.checked })} />
            Tampilkan pengumuman di dashboard member
          </label>
          <textarea className="input" rows={3} value={f.announcement ?? ''} onChange={(e) => setF({ ...f, announcement: e.target.value })}
            placeholder="mis. Malam ini kita coba pilih jadwal langsung lewat web! Buka menu Jadwal → pilih kelas → booking. Yuk dicoba 🧘" />
          <p className="text-[11px] text-ink/40">Muncul sbg banner di halaman utama member (yang login). Kosongkan / matikan centang untuk menyembunyikan.</p>
          <div className="pt-2 border-t border-sand">
            <label className="label">Tampilkan jadwal member mulai tanggal</label>
            <input type="date" className="input !w-48" value={f.member_schedule_start ?? ''} onChange={(e) => setF({ ...f, member_schedule_start: e.target.value })} />
            <p className="text-[11px] text-ink/40 mt-1">Member hanya lihat jadwal sejak tanggal ini. Kosongkan untuk tampilkan semua (sejak hari ini).</p>
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="font-semibold">Aturan booking</h2>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={f.waitlist_enabled !== false} onChange={(e) => setF({ ...f, waitlist_enabled: e.target.checked })} />
            <span>Aktifkan <b>waitlist</b> saat kelas penuh. <span className="text-ink/50">Jika dimatikan, kelas penuh (mis. 14/14) langsung <b>terkunci</b> — member tak bisa gabung daftar tunggu.</span></span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Batas batal (jam)</label>
              <input className="input" type="number" min={0} value={f.cancellation_window_hours ?? 12}
                onChange={(e) => setF({ ...f, cancellation_window_hours: Number(e.target.value) })} />
              <p className="text-[11px] text-ink/40 mt-1">Batal lebih awal dari ini → kuota kembali.</p>
            </div>
            <div><label className="label">Tutup booking (jam sebelum mulai)</label>
              <input className="input" type="number" min={0} value={f.booking_lead_close_hours ?? 0}
                onChange={(e) => setF({ ...f, booking_lead_close_hours: Number(e.target.value) })} />
              <p className="text-[11px] text-ink/40 mt-1">Member yang belum booking bisa memesan sampai sekian jam sebelum kelas mulai (0 = sampai kelas mulai).</p>
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
          <p className="text-[11px] text-ink/45 -mt-2">Kapan booking dibuka/ditutup, dihitung dari tanggal kelas. Semua waktu WITA. H-2 = dua hari sebelum kelas. <span className="text-copper-600">Jam "dibuka" juga = jam kirim broadcast jadwal WA</span> (bulanan → grup; per-datang → personal bertiket).</p>
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

        <div className="card space-y-4">
          <h2 className="font-semibold">Broadcast Jadwal WhatsApp</h2>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={!!f.wa_broadcast_enabled} onChange={(e) => setF({ ...f, wa_broadcast_enabled: e.target.checked })} />
            <span>Aktifkan broadcast otomatis. <span className="text-ink/50">H-2 20:00 → post ke grup bulanan/private; H-1 20:00 → WA personal ke per-datang bertiket.</span></span>
          </label>
          <div>
            <label className="label">Grup WhatsApp (bulanan &amp; private)</label>
            <div className="flex gap-2">
              <select className="input flex-1" value={f.wa_group_bulanan ?? ''} onChange={(e) => setF({ ...f, wa_group_bulanan: e.target.value })}>
                <option value="">— pilih grup —</option>
                {f.wa_group_bulanan && !groups?.some((g) => g.jid === f.wa_group_bulanan) && <option value={f.wa_group_bulanan}>Tersimpan: {f.wa_group_bulanan}</option>}
                {groups?.map((g) => <option key={g.jid} value={g.jid}>{g.name}</option>)}
              </select>
              <button type="button" onClick={() => setWantGroups(true)} className="btn-ghost border border-sand shrink-0">
                {groupsLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Muat grup
              </button>
            </div>
            <p className="text-[11px] text-ink/40 mt-1">Klik "Muat grup" untuk ambil daftar grup dari akun WhatsApp gateway, lalu pilih grup member. Nomor gateway harus jadi anggota grup.</p>
          </div>
          <div>
            <label className="label">Link booking (dicantumkan di pesan)</label>
            <input className="input" value={f.booking_url ?? ''} onChange={(e) => setF({ ...f, booking_url: e.target.value })} placeholder="https://reformeryourbody.com/jadwal" />
          </div>
          <div className="border-t border-sand pt-3">
            <p className="text-[11px] text-ink/45 mb-2">Uji kirim (pakai pengaturan yang <b>sudah disimpan</b>). Bulanan → sesi H-2; per-datang → sesi H-1.</p>
            <div className="flex gap-2 flex-wrap">
              <button type="button" onClick={() => testBroadcast('bulanan')} className="btn-ghost border border-sand text-sm"><Send size={15} /> Uji ke grup</button>
              <button type="button" onClick={() => testBroadcast('dropin')} className="btn-ghost border border-sand text-sm"><Send size={15} /> Uji personal per-datang</button>
            </div>
            {testMsg && <div className="text-xs text-ink/60 bg-sand/60 rounded-lg px-3 py-2 mt-2">{testMsg}</div>}
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

const LANDING_SLOTS: [string, string, string][] = [
  ['hero', 'Foto hero (latar utama)', 'Landscape lebar & resolusi tinggi — tampil penuh di bagian atas landing.'],
  ['about', 'Foto seksi "Kenapa reformer"', 'Potret suasana kelas / instruktur.'],
  ['class1', 'Foto kelas — Reformer Flow', ''],
  ['class2', 'Foto kelas — Reformer Basic', ''],
  ['class3', 'Foto kelas — Private Session', ''],
]

function LandingPhotos() {
  const qc = useQueryClient()
  const [busy, setBusy] = useState<string | null>(null)
  const { data: media } = useQuery({
    queryKey: ['landing-media'],
    queryFn: async () => (await api.get<Record<string, string>>('/studio/landing-media')).data,
  })

  async function upload(slot: string, file: File) {
    setBusy(slot)
    try {
      const fd = new FormData(); fd.append('file', file)
      await api.post(`/studio/landing-media/${slot}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      qc.invalidateQueries({ queryKey: ['landing-media'] })
      qc.invalidateQueries({ queryKey: ['public-studio'] })
    } catch (e: any) { alert(e?.response?.data?.detail ?? 'Gagal mengunggah foto') }
    finally { setBusy(null) }
  }
  async function remove(slot: string) {
    if (!confirm('Hapus foto ini? Bagian itu kembali ke placeholder.')) return
    setBusy(slot)
    try {
      await api.delete(`/studio/landing-media/${slot}`)
      qc.invalidateQueries({ queryKey: ['landing-media'] })
      qc.invalidateQueries({ queryKey: ['public-studio'] })
    } catch (e: any) { alert(e?.response?.data?.detail ?? 'Gagal menghapus foto') }
    finally { setBusy(null) }
  }

  return (
    <div className="card space-y-4">
      <div>
        <h2 className="font-semibold">Foto Landing Page</h2>
        <p className="text-[11px] text-ink/45 mt-0.5">Foto ini tampil di halaman publik. Slot kosong memakai placeholder. Format JPG/PNG/WebP, maks 8 MB.</p>
      </div>
      <div className="space-y-2.5">
        {LANDING_SLOTS.map(([slot, label, hint]) => {
          const url = media?.[slot]
          return (
            <div key={slot} className="flex items-center gap-3 border border-sand rounded-xl p-3">
              <div className="w-20 h-16 rounded-lg overflow-hidden bg-sand grid place-items-center shrink-0">
                {url ? <img src={url} alt={label} className="w-full h-full object-cover" /> : <ImageIcon size={20} className="text-ink/30" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{label}</div>
                {hint && <div className="text-[11px] text-ink/45 mt-0.5">{hint}</div>}
              </div>
              <div className="flex gap-1.5 shrink-0">
                <label className="btn-ghost border border-sand !px-2.5 !py-1.5 cursor-pointer" title="Unggah / ganti">
                  {busy === slot ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(slot, f); e.target.value = '' }} />
                </label>
                {url && <button type="button" onClick={() => remove(slot)} disabled={busy === slot}
                  className="btn-ghost border border-sand !px-2.5 !py-1.5 text-clay-dark" title="Hapus"><Trash2 size={15} /></button>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
