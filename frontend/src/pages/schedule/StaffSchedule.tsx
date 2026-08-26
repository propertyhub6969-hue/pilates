import { useState, Fragment } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/services/api'
import { useBranch } from '@/context/BranchContext'
import type { ClassSession, ClassTemplate, BookingRow, Page, User } from '@/types'
import { DAY_NAMES, BOOKING_STATUS_LABEL } from '@/types'
import { formatTime, formatDayDate } from '@/utils/format'
import Modal from '@/components/Modal'
import {
  Plus, RefreshCw, Users, UserRound, MapPin, Loader2, CalendarDays,
  Pencil, Trash2, XCircle, CheckCircle2, RotateCcw, ChevronRight, ArrowRight,
} from 'lucide-react'

// Tanggal "hari ini" menurut zona studio (WITA) — hindari bug UTC di dekat tengah malam.
const todayISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date())

const TABS = [
  { key: 'sesi', label: 'Sesi' },
  { key: 'template', label: 'Template' },
  { key: 'kehadiran', label: 'Kehadiran' },
] as const
type TabKey = typeof TABS[number]['key']

export default function StaffSchedule() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<TabKey>('sesi')
  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-semibold">Jadwal & Booking</h1>
      <div className="flex gap-2">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
              tab === t.key ? 'bg-copper-600 text-white' : 'bg-sand text-ink/60 hover:bg-copper-100'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'sesi' && <SessionsTab qc={qc} />}
      {tab === 'template' && <TemplatesTab qc={qc} />}
      {tab === 'kehadiran' && <AttendanceTab />}
    </div>
  )
}

function AttendanceTab() {
  const { activeId } = useBranch()
  const [range, setRange] = useState({
    from: new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10),
    to: todayISO(),
  })
  const { data, isLoading } = useQuery({
    queryKey: ['attendance-report', range, activeId],
    queryFn: async () =>
      (await api.get('/reports/attendance', { params: { from: range.from, to: range.to, branch_id: activeId } })).data as {
        sessions_total: number; sessions_cancelled: number; attended: number; no_show: number
        booked_open: number; attendance_rate: number
        top_members: { member_id: string; member_name: string; attended: number; no_show: number }[]
      },
  })

  const stats = data ? [
    { label: 'Tingkat kehadiran', value: `${Math.round(data.attendance_rate * 100)}%`, accent: true },
    { label: 'Hadir', value: data.attended },
    { label: 'Tidak hadir', value: data.no_show },
    { label: 'Sesi', value: data.sessions_total },
  ] : []

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-end flex-wrap">
        <div><label className="label">Dari</label><input type="date" className="input" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></div>
        <div><label className="label">Sampai</label><input type="date" className="input" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></div>
      </div>

      {isLoading || !data ? <div className="text-ink/40 py-10 text-center">Memuat…</div> : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {stats.map((s) => (
              <div key={s.label} className={`card text-center ${s.accent ? 'bg-copper-50 border-copper-100' : ''}`}>
                <div className={`font-display text-2xl font-semibold ${s.accent ? 'text-copper-700' : ''}`}>{s.value}</div>
                <div className="text-xs text-ink/50 mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          <div>
            <h3 className="font-display font-semibold mb-2">Peserta paling rajin</h3>
            <div className="space-y-2">
              {data.top_members.map((m, i) => (
                <div key={m.member_id} className="card flex items-center gap-3">
                  <span className="grid place-items-center w-7 h-7 rounded-full bg-sand text-ink/50 text-sm font-semibold shrink-0">{i + 1}</span>
                  <div className="flex-1 font-semibold text-sm">{m.member_name}</div>
                  <div className="text-sm"><span className="text-copper-700 font-semibold">{m.attended} hadir</span>
                    {m.no_show > 0 && <span className="text-ink/40"> · {m.no_show} absen</span>}</div>
                </div>
              ))}
              {data.top_members.length === 0 && <div className="text-ink/40 text-center py-8">Belum ada data kehadiran di rentang ini.</div>}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function useInstructors() {
  return useQuery({
    queryKey: ['instructors'],
    queryFn: async () => (await api.get<Page<User>>('/members', { params: { role: 'instructor' } })).data.items,
  })
}

// ─────────────── SESI ───────────────
const plusDays = (n: number) => {
  const [y, m, d] = todayISO().split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

type SchedView = 'upcoming' | 'today' | 'h1' | 'h2' | 'range'
const VIEW_CHIPS: { k: SchedView; label: string }[] = [
  { k: 'upcoming', label: 'Mendatang' },
  { k: 'today', label: 'Hari ini' },
  { k: 'h1', label: 'Besok · H-1' },
  { k: 'h2', label: 'Lusa · H-2' },
  { k: 'range', label: 'Rentang' },
]

function SessionsTab({ qc }: { qc: ReturnType<typeof useQueryClient> }) {
  const { activeId } = useBranch()
  const [openNew, setOpenNew] = useState(false)
  const [rosterFor, setRosterFor] = useState<ClassSession | null>(null)
  const [view, setView] = useState<SchedView>('upcoming')
  const [custom, setCustom] = useState({ from: todayISO(), to: plusDays(21) })

  // Tanggal lewat tidak ditampilkan: semua preset mulai dari hari ini.
  const range = view === 'today' ? { from: todayISO(), to: todayISO() }
    : view === 'h1' ? { from: plusDays(1), to: plusDays(1) }
    : view === 'h2' ? { from: plusDays(2), to: plusDays(2) }
    : view === 'range' ? { from: custom.from < todayISO() ? todayISO() : custom.from, to: custom.to }
    : { from: todayISO(), to: plusDays(21) }

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['staff-sessions', activeId, range.from, range.to],
    enabled: !!activeId,
    queryFn: async () => (await api.get<ClassSession[]>('/schedule/sessions', { params: { from: range.from, to: range.to, branch_id: activeId } })).data,
  })
  const generate = useMutation({
    mutationFn: async () => (await api.post('/schedule/generate', { weeks: 4, branch_id: activeId })).data,
    onSuccess: (r: any) => { qc.invalidateQueries({ queryKey: ['staff-sessions'] }); alert(`Selesai: ${r.created} sesi dibuat, ${r.skipped} dilewati.`) },
  })

  const groups = new Map<string, ClassSession[]>()
  for (const s of sessions ?? []) { if (!groups.has(s.session_date)) groups.set(s.session_date, []); groups.get(s.session_date)!.push(s) }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setOpenNew(true)} className="btn-primary"><Plus size={16} /> Sesi</button>
        <button onClick={() => generate.mutate()} disabled={generate.isPending} className="btn-ghost border border-sand">
          {generate.isPending ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Generate dari template
        </button>
      </div>

      {/* Filter tahap pipeline — tanggal lewat tidak ditampilkan */}
      <div className="flex gap-2 flex-wrap items-center">
        {VIEW_CHIPS.map((c) => (
          <button key={c.k} onClick={() => setView(c.k)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
              view === c.k ? 'bg-copper-600 text-white' : 'bg-sand text-ink/60 hover:bg-copper-100'}`}>
            {c.label}
          </button>
        ))}
        {view === 'range' && (
          <div className="flex gap-2 items-end ml-1">
            <div><label className="label !mb-1 text-xs">Dari</label><input type="date" min={todayISO()} className="input !py-1.5" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} /></div>
            <button type="button" onClick={() => setCustom({ ...custom, to: custom.from })} title="Samakan: Sampai = Dari (lihat 1 hari)"
              className="btn-ghost !px-2 !py-2 border border-sand text-copper-600 self-end"><ArrowRight size={16} /></button>
            <div><label className="label !mb-1 text-xs">Sampai</label><input type="date" min={todayISO()} className="input !py-1.5" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} /></div>
          </div>
        )}
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink/45 text-xs uppercase tracking-wide border-b border-sand">
                <th className="font-semibold px-4 py-3">Jam</th>
                <th className="font-semibold px-4 py-3">Kelas</th>
                <th className="font-semibold px-4 py-3 hidden sm:table-cell">Instruktur</th>
                <th className="font-semibold px-4 py-3 hidden md:table-cell">Ruang</th>
                <th className="font-semibold px-4 py-3">Terisi</th>
                <th className="font-semibold px-4 py-3">Status</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-ink/40">Memuat…</td></tr>
              ) : (sessions?.length ?? 0) === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-ink/40">Belum ada sesi. Buat template lalu Generate, atau tambah sesi manual.</td></tr>
              ) : (
                Array.from(groups.entries()).map(([day, list]) => (
                  <Fragment key={day}>
                    <tr className="bg-sand/50"><td colSpan={7} className="px-4 py-2 font-display font-semibold capitalize text-ink/70">{formatDayDate(day)}</td></tr>
                    {list.map((s) => (
                      <tr key={s.id} onClick={() => setRosterFor(s)}
                        className={`border-b border-sand/60 hover:bg-sand/40 cursor-pointer transition ${s.status === 'cancelled' ? 'opacity-50' : ''}`}>
                        <td className="px-4 py-3 font-display font-semibold text-copper-700 whitespace-nowrap">{formatTime(s.start_time)}</td>
                        <td className="px-4 py-3 font-semibold">{s.title}{s.category === 'private' && <span className="ml-1.5 text-[10px] rounded-full px-2 py-0.5 bg-clay/15 text-clay-dark align-middle">Private</span>}</td>
                        <td className="px-4 py-3 text-ink/60 hidden sm:table-cell">{s.instructor_name ?? '—'}</td>
                        <td className="px-4 py-3 text-ink/60 hidden md:table-cell">{s.room ?? '—'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 font-semibold"><Users size={14} />{s.booked_count}/{s.capacity}</span>
                          {s.waitlist_count > 0 && <span className="text-[11px] text-clay-dark ml-1">+{s.waitlist_count} wl</span>}
                          <span className="block text-[11px] text-ink/40">{s.bulanan_count} bulanan</span>
                        </td>
                        <td className="px-4 py-3">
                          {s.status === 'cancelled' ? <span className="text-xs rounded-full px-2 py-0.5 bg-clay/10 text-clay-dark">Dibatalkan</span>
                            : s.status === 'completed' ? <span className="text-xs rounded-full px-2 py-0.5 bg-sand text-ink/50">Selesai</span>
                            : <span className="text-xs rounded-full px-2 py-0.5 bg-copper-100 text-copper-700">Terjadwal</span>}
                          {s.is_underfilled && <span className="text-xs rounded-full px-2 py-0.5 bg-clay/15 text-clay-dark ml-1" title="Bulanan di bawah target minimal">Sepi</span>}
                        </td>
                        <td className="px-2"><ChevronRight size={16} className="text-ink/30" /></td>
                      </tr>
                    ))}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {openNew && <SessionForm qc={qc} onClose={() => setOpenNew(false)} />}
      {rosterFor && <RosterModal qc={qc} session={rosterFor} onClose={() => setRosterFor(null)} />}
    </div>
  )
}

function SessionForm({ qc, onClose }: { qc: ReturnType<typeof useQueryClient>; onClose: () => void }) {
  const { activeId } = useBranch()
  const { data: instructors } = useInstructors()
  const [f, setF] = useState({ title: '', instructor_id: '', session_date: todayISO(), start_time: '07:00', duration_minutes: '55', capacity: '8', room: '', category: 'umum' as 'umum' | 'private' })
  const [err, setErr] = useState('')
  const save = useMutation({
    mutationFn: async () => api.post('/schedule/sessions', {
      branch_id: activeId,
      title: f.title, instructor_id: f.instructor_id || null, session_date: f.session_date,
      start_time: f.start_time, duration_minutes: Number(f.duration_minutes), capacity: Number(f.capacity), room: f.room || null,
      category: f.category,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staff-sessions'] }); onClose() },
    onError: (e: any) => setErr(e?.response?.data?.detail ?? 'Gagal menyimpan'),
  })
  return (
    <Modal open onClose={onClose} title="Tambah Sesi">
      <form onSubmit={(e) => { e.preventDefault(); setErr(''); save.mutate() }} className="space-y-4">
        <div><label className="label">Nama kelas</label><input className="input" required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
        <div><label className="label">Kategori jadwal</label>
          <select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as 'umum' | 'private' })}>
            <option value="umum">Umum (tampil di aplikasi member)</option>
            <option value="private">Private Group (tak tampil di aplikasi member; info via WA)</option>
          </select>
        </div>
        <div><label className="label">Instruktur</label>
          <select className="input" value={f.instructor_id} onChange={(e) => setF({ ...f, instructor_id: e.target.value })}>
            <option value="">— tanpa instruktur —</option>
            {instructors?.map((i) => <option key={i.id} value={i.id}>{i.full_name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Tanggal</label><input className="input" type="date" required value={f.session_date} onChange={(e) => setF({ ...f, session_date: e.target.value })} /></div>
          <div><label className="label">Jam mulai</label><input className="input" type="time" required value={f.start_time} onChange={(e) => setF({ ...f, start_time: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className="label">Durasi (mnt)</label><input className="input" type="number" value={f.duration_minutes} onChange={(e) => setF({ ...f, duration_minutes: e.target.value })} /></div>
          <div><label className="label">Kapasitas</label><input className="input" type="number" value={f.capacity} onChange={(e) => setF({ ...f, capacity: e.target.value })} /></div>
          <div><label className="label">Ruang</label><input className="input" value={f.room} onChange={(e) => setF({ ...f, room: e.target.value })} /></div>
        </div>
        {err && <div className="text-sm text-clay-dark bg-clay/10 border border-clay/20 rounded-lg px-3 py-2">{err}</div>}
        <button className="btn-primary w-full" disabled={save.isPending}>{save.isPending && <Loader2 size={16} className="animate-spin" />} Simpan</button>
      </form>
    </Modal>
  )
}

function RosterModal({ qc, session, onClose }: { qc: ReturnType<typeof useQueryClient>; session: ClassSession; onClose: () => void }) {
  const { data: roster, isLoading } = useQuery({
    queryKey: ['roster', session.id],
    queryFn: async () => (await api.get<BookingRow[]>(`/schedule/sessions/${session.id}/roster`)).data,
  })
  const { data: members } = useQuery({
    queryKey: ['members-all'],
    queryFn: async () => (await api.get<Page<User>>('/members', { params: { role: 'member', limit: 200 } })).data.items,
  })
  const [addId, setAddId] = useState('')
  const inval = () => { qc.invalidateQueries({ queryKey: ['roster', session.id] }); qc.invalidateQueries({ queryKey: ['staff-sessions'] }) }

  // Karyawan pendamping (dibayar per sesi) — admin tandai kehadiran di sesi ini
  const { data: assistants } = useQuery({
    queryKey: ['assistants'],
    queryFn: async () => (await api.get<{ id: string; name: string }[]>('/employees/assistants')).data,
  })
  const [assistantId, setAssistantId] = useState(session.assistant_id ?? '')
  const setAssistant = useMutation({
    mutationFn: async (id: string) => api.patch(`/schedule/sessions/${session.id}/assistant`, { assistant_id: id || null }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff-sessions'] }),
    onError: (e: any) => alert(e?.response?.data?.detail ?? 'Gagal menandai pendamping'),
  })

  const addMember = useMutation({
    mutationFn: async () => api.post('/bookings', { session_id: session.id, member_id: addId }),
    onSuccess: () => { setAddId(''); inval() },
    onError: (e: any) => alert(e?.response?.data?.detail ?? 'Gagal menambah'),
  })
  const [guestName, setGuestName] = useState('')
  const addGuest = useMutation({
    mutationFn: async () => api.post(`/schedule/sessions/${session.id}/add-guest`, { name: guestName.trim() }),
    onSuccess: () => { setGuestName(''); inval() },
    onError: (e: any) => alert(e?.response?.data?.detail ?? 'Gagal menambah nama'),
  })
  const cancelBooking = useMutation({
    mutationFn: async (bid: string) => api.post(`/bookings/${bid}/cancel`),
    onSuccess: inval,
  })
  const attend = useMutation({
    mutationFn: async (v: { bid: string; status: 'attended' | 'no_show' | 'booked'; forfeit?: boolean }) =>
      api.patch(`/bookings/${v.bid}/attendance`, { status: v.status, forfeit: v.forfeit ?? true }),
    onSuccess: inval,
  })
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelNotify, setCancelNotify] = useState(true)
  const cancelSessionNotify = useMutation({
    mutationFn: async () => api.post(`/schedule/sessions/${session.id}/cancel`, null, { params: { notify: cancelNotify } }),
    onSuccess: () => { inval(); onClose() },
    onError: (e: any) => alert(e?.response?.data?.detail ?? 'Gagal membatalkan sesi'),
  })

  const shown = (roster ?? []).filter((r) => r.status !== 'cancelled')
  // Hanya tampilkan member yang bisa ditambah: punya kuota/unlimited & belum ada di sesi ini
  const rosterIds = new Set(shown.map((r) => r.member_id))
  const addable = (members ?? []).filter(
    (m) => (m.has_unlimited || (m.active_sessions_remaining ?? 0) > 0) && !rosterIds.has(m.id)
  )

  return (
    <Modal open onClose={onClose} title={`${session.title} · ${formatTime(session.start_time)}`} maxWidth="max-w-lg">
      <div className="space-y-4">
        <div className="text-sm text-ink/60 capitalize">{formatDayDate(session.session_date)} · {session.booked_count}/{session.capacity} terisi</div>

        {session.status !== 'cancelled' && (
          <div className="flex gap-2">
            <select className="input flex-1" value={addId} onChange={(e) => setAddId(e.target.value)}>
              <option value="">{addable.length ? '+ Tambah member ke sesi…' : 'Tak ada member ber-kuota'}</option>
              {addable.map((m) => <option key={m.id} value={m.id}>{m.full_name}{m.has_unlimited ? ' · ∞' : ` · sisa ${m.active_sessions_remaining ?? 0}`}</option>)}
            </select>
            <button className="btn-primary" disabled={!addId || addMember.isPending} onClick={() => addMember.mutate()}>Tambah</button>
          </div>
        )}

        {session.status !== 'cancelled' && (
          <div className="flex gap-2">
            <input className="input flex-1" placeholder="+ Tambah nama manual (tamu/walk-in)…" value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && guestName.trim().length >= 2) { e.preventDefault(); addGuest.mutate() } }} />
            <button className="btn-ghost border border-sand" disabled={guestName.trim().length < 2 || addGuest.isPending}
              onClick={() => addGuest.mutate()}>
              {addGuest.isPending ? <Loader2 size={15} className="animate-spin" /> : 'Tambah nama'}
            </button>
          </div>
        )}

        {session.status !== 'cancelled' && (assistants?.length ?? 0) > 0 && (
          <div className="flex items-center gap-2 rounded-xl bg-sand/40 px-3 py-2">
            <span className="text-sm text-ink/60 shrink-0">Staf pendamping</span>
            <select className="input !py-1.5 flex-1" value={assistantId}
              onChange={(e) => { setAssistantId(e.target.value); setAssistant.mutate(e.target.value) }}>
              <option value="">— Tidak ada —</option>
              {assistants!.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            {setAssistant.isPending && <Loader2 size={15} className="animate-spin text-ink/30" />}
          </div>
        )}

        {isLoading ? <div className="text-ink/40 py-6 text-center">Memuat…</div> : (
          <div className="space-y-1">
            {shown.map((r) => (
              <div key={r.id} className="flex items-center gap-2 py-2 border-b border-sand last:border-0">
                <span className={`grid place-items-center w-8 h-8 rounded-full shrink-0 ${
                  r.status === 'attended' ? 'bg-copper-600 text-white' : r.status === 'no_show' ? 'bg-sand text-ink/40' : 'bg-copper-100 text-copper-700'}`}>
                  {r.status === 'attended' ? <CheckCircle2 size={16} /> : <UserRound size={16} />}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{r.member_name}</div>
                  <div className="text-[11px] text-ink/50">
                    {BOOKING_STATUS_LABEL[r.status]}
                    {r.status === 'waitlist' && r.waitlist_position ? ` #${r.waitlist_position}` : ''}
                    {r.status === 'no_show' ? (r.consumed ? ' · hangus' : ' · tetap') : ''}
                  </div>
                </div>
                {/* Kontrol absensi */}
                {r.status === 'booked' && (
                  <div className="flex items-center gap-1 flex-wrap justify-end">
                    <button onClick={() => attend.mutate({ bid: r.id, status: 'attended' })} disabled={attend.isPending}
                      className="btn-primary !px-3 !py-1.5 text-xs">Hadir</button>
                    <button onClick={() => attend.mutate({ bid: r.id, status: 'no_show', forfeit: true })} disabled={attend.isPending}
                      className="btn-ghost !px-2 !py-1.5 text-xs text-clay-dark border border-clay/20" title="Tidak hadir — sesi HANGUS (kuota terpakai)">Hangus</button>
                    <button onClick={() => attend.mutate({ bid: r.id, status: 'no_show', forfeit: false })} disabled={attend.isPending}
                      className="btn-ghost !px-2 !py-1.5 text-xs text-ink/50 border border-sand" title="Tidak hadir — sesi TETAP (kuota kembali)">Tetap</button>
                    <button onClick={() => cancelBooking.mutate(r.id)} className="btn-ghost !px-2 !py-1.5 text-clay-dark" title="Batalkan booking"><XCircle size={16} /></button>
                  </div>
                )}
                {(r.status === 'attended' || r.status === 'no_show') && (
                  <button onClick={() => attend.mutate({ bid: r.id, status: 'booked' })} disabled={attend.isPending}
                    className="btn-ghost !px-2 !py-1.5 text-xs text-ink/50" title="Batalkan absen"><RotateCcw size={15} /></button>
                )}
                {r.status === 'waitlist' && (
                  <button onClick={() => cancelBooking.mutate(r.id)} className="btn-ghost !px-2 !py-1.5 text-clay-dark" title="Batalkan"><XCircle size={16} /></button>
                )}
              </div>
            ))}
            {shown.length === 0 && <div className="text-ink/40 text-sm py-4 text-center">Belum ada peserta.</div>}
          </div>
        )}

        {session.status !== 'cancelled' && !cancelOpen && (
          <button onClick={() => setCancelOpen(true)} className="btn-ghost w-full text-clay-dark border border-clay/20"><XCircle size={16} /> Batalkan sesi</button>
        )}

        {session.status !== 'cancelled' && cancelOpen && (
          <div className="rounded-xl border border-clay/20 bg-clay/5 p-3 space-y-3">
            <div className="text-sm font-semibold text-clay-dark">Batalkan sesi ini?</div>
            <p className="text-[11px] text-ink/50">Kuota/tiket semua peserta dikembalikan otomatis.</p>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={cancelNotify} onChange={(e) => setCancelNotify(e.target.checked)} />
              Beri tahu peserta via WhatsApp
            </label>
            <div className="flex gap-2">
              <button onClick={() => cancelSessionNotify.mutate()} disabled={cancelSessionNotify.isPending}
                className="btn-primary flex-1 !bg-clay-dark hover:!bg-clay-dark/90">
                {cancelSessionNotify.isPending && <Loader2 size={15} className="animate-spin" />} Ya, batalkan
              </button>
              <button type="button" onClick={() => setCancelOpen(false)} className="btn-ghost border border-sand">Tidak</button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

// ─────────────── TEMPLATE ───────────────
function TemplatesTab({ qc }: { qc: ReturnType<typeof useQueryClient> }) {
  const { activeId } = useBranch()
  const { data: instructors } = useInstructors()
  const { data, isLoading } = useQuery({
    queryKey: ['templates', activeId],
    enabled: !!activeId,
    queryFn: async () => (await api.get<Page<ClassTemplate>>('/schedule/templates', { params: { branch_id: activeId } })).data,
  })
  const [edit, setEdit] = useState<ClassTemplate | 'new' | null>(null)
  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/schedule/templates/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  })

  return (
    <div className="space-y-4">
      <button onClick={() => setEdit('new')} className="btn-primary"><Plus size={16} /> Template</button>
      {isLoading ? <div className="text-ink/40 py-10 text-center">Memuat…</div> : (
        <div className="space-y-2">
          {data?.items.map((t) => (
            <div key={t.id} className={`card flex items-center gap-4 ${!t.is_active ? 'opacity-50' : ''}`}>
              <div className="text-center shrink-0 w-16">
                <div className="font-semibold text-sm">{DAY_NAMES[t.day_of_week]}</div>
                <div className="text-copper-700 font-display">{formatTime(t.start_time)}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{t.name}</div>
                <div className="text-xs text-ink/50">{t.instructor_name ?? 'tanpa instruktur'} · kapasitas {t.capacity}{t.room ? ` · ${t.room}` : ''}</div>
              </div>
              <button onClick={() => setEdit(t)} className="btn-ghost !px-2 !py-1.5"><Pencil size={15} /></button>
              <button onClick={() => del.mutate(t.id)} className="btn-ghost !px-2 !py-1.5 text-clay-dark"><Trash2 size={15} /></button>
            </div>
          ))}
          {data?.items.length === 0 && <div className="text-ink/40 text-center py-10">Belum ada template. Tambahkan jadwal rutin mingguan.</div>}
        </div>
      )}
      {edit && <TemplateForm qc={qc} instructors={instructors ?? []} tpl={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
    </div>
  )
}

function TemplateForm({ qc, instructors, tpl, onClose }: {
  qc: ReturnType<typeof useQueryClient>; instructors: User[]; tpl: ClassTemplate | null; onClose: () => void
}) {
  const { activeId } = useBranch()
  const [f, setF] = useState({
    name: tpl?.name ?? '', instructor_id: tpl?.instructor_id ?? '', day_of_week: String(tpl?.day_of_week ?? 0),
    start_time: tpl ? formatTime(tpl.start_time) : '07:00', duration_minutes: String(tpl?.duration_minutes ?? 55),
    capacity: String(tpl?.capacity ?? 8), room: tpl?.room ?? '', category: (tpl?.category ?? 'umum') as 'umum' | 'private',
  })
  const [err, setErr] = useState('')
  const save = useMutation({
    mutationFn: async () => {
      const body: any = {
        name: f.name, instructor_id: f.instructor_id || null, day_of_week: Number(f.day_of_week),
        start_time: f.start_time, duration_minutes: Number(f.duration_minutes), capacity: Number(f.capacity), room: f.room || null,
        category: f.category,
      }
      if (tpl) return api.patch(`/schedule/templates/${tpl.id}`, body)
      return api.post('/schedule/templates', { ...body, branch_id: activeId })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['templates'] }); onClose() },
    onError: (e: any) => setErr(e?.response?.data?.detail ?? 'Gagal menyimpan'),
  })
  return (
    <Modal open onClose={onClose} title={tpl ? 'Ubah Template' : 'Tambah Template'}>
      <form onSubmit={(e) => { e.preventDefault(); setErr(''); save.mutate() }} className="space-y-4">
        <div><label className="label">Nama kelas</label><input className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div><label className="label">Kategori jadwal</label>
          <select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as 'umum' | 'private' })}>
            <option value="umum">Umum (tampil di aplikasi member)</option>
            <option value="private">Private Group (tak tampil di aplikasi member)</option>
          </select>
        </div>
        <div><label className="label">Instruktur</label>
          <select className="input" value={f.instructor_id} onChange={(e) => setF({ ...f, instructor_id: e.target.value })}>
            <option value="">— tanpa instruktur —</option>
            {instructors.map((i) => <option key={i.id} value={i.id}>{i.full_name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Hari</label>
            <select className="input" value={f.day_of_week} onChange={(e) => setF({ ...f, day_of_week: e.target.value })}>
              {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
          </div>
          <div><label className="label">Jam mulai</label><input className="input" type="time" required value={f.start_time} onChange={(e) => setF({ ...f, start_time: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className="label">Durasi (mnt)</label><input className="input" type="number" value={f.duration_minutes} onChange={(e) => setF({ ...f, duration_minutes: e.target.value })} /></div>
          <div><label className="label">Kapasitas</label><input className="input" type="number" value={f.capacity} onChange={(e) => setF({ ...f, capacity: e.target.value })} /></div>
          <div><label className="label">Ruang</label><input className="input" value={f.room} onChange={(e) => setF({ ...f, room: e.target.value })} /></div>
        </div>
        {err && <div className="text-sm text-clay-dark bg-clay/10 border border-clay/20 rounded-lg px-3 py-2">{err}</div>}
        <button className="btn-primary w-full" disabled={save.isPending}>{save.isPending && <Loader2 size={16} className="animate-spin" />} Simpan</button>
      </form>
    </Modal>
  )
}
