import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/services/api'
import { useBranch } from '@/context/BranchContext'
import type { ClassSession } from '@/types'
import { formatTime, formatDayDate } from '@/utils/format'
import { Clock, MapPin, UserRound, Users, Loader2, CalendarDays, Building2, Check, ArrowRight, Repeat, X } from 'lucide-react'

function endTime(start: string, mins: number): string {
  const [h, m] = start.split(':').map(Number)
  const d = new Date(2000, 0, 1, h, m + mins)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// Tanggal zona studio (WITA)
const todayISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date())
const plusDays = (n: number) => { const [y, m, d] = todayISO().split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10) }

const openLabel = (iso?: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function groupByDate(sessions: ClassSession[]) {
  const map = new Map<string, ClassSession[]>()
  for (const s of sessions) {
    if (!map.has(s.session_date)) map.set(s.session_date, [])
    map.get(s.session_date)!.push(s)
  }
  return Array.from(map.entries())
}

export default function MemberSchedule() {
  const qc = useQueryClient()
  const { branches, activeId, setActiveId } = useBranch()
  const [tab, setTab] = useState<'all' | 'mine'>('all')
  const [range, setRange] = useState({ from: todayISO(), to: plusDays(14) })
  const [instructorId, setInstructorId] = useState('')
  const [rescheduleFrom, setRescheduleFrom] = useState<ClassSession | null>(null)

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['sessions', tab, activeId, range.from, range.to],
    enabled: tab === 'mine' || !!activeId,
    queryFn: async () =>
      (await api.get<ClassSession[]>('/schedule/sessions', {
        params: tab === 'mine' ? { mine: true } : { branch_id: activeId, from: range.from, to: range.to },
      })).data,
  })

  // Opsi instruktur diambil dari sesi yang tampil; filter di sisi klien.
  const instructors = Array.from(
    new Map((sessions ?? []).filter((s) => s.instructor_id).map((s) => [s.instructor_id!, s.instructor_name ?? '—'])).entries()
  )
  const shown = (sessions ?? []).filter((s) => !instructorId || s.instructor_id === instructorId)

  const book = useMutation({
    mutationFn: async (session_id: string) => api.post('/bookings', { session_id }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sessions'] }); qc.invalidateQueries({ queryKey: ['me-detail'] }) },
    onError: (e: any) => alert(e?.response?.data?.detail ?? 'Gagal booking'),
  })
  const cancelBooking = useMutation({
    mutationFn: async (booking_id: string) => api.post(`/bookings/${booking_id}/cancel`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sessions'] }); qc.invalidateQueries({ queryKey: ['me-detail'] }) },
    onError: (e: any) => alert(e?.response?.data?.detail ?? 'Gagal membatalkan'),
  })
  const reschedule = useMutation({
    mutationFn: async ({ booking_id, new_session_id }: { booking_id: string; new_session_id: string }) =>
      api.post(`/bookings/${booking_id}/reschedule`, { new_session_id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions'] }); qc.invalidateQueries({ queryKey: ['me-detail'] })
      setRescheduleFrom(null)
    },
    onError: (e: any) => alert(e?.response?.data?.detail ?? 'Gagal memindah jadwal'),
  })

  const groups = groupByDate(shown)

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-semibold">Jadwal Kelas</h1>

      <div className="flex gap-2">
        {(['all', 'mine'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
              tab === t ? 'bg-copper-600 text-white' : 'bg-sand text-ink/60 hover:bg-copper-100'}`}>
            {t === 'all' ? 'Semua kelas' : 'Jadwalku'}
          </button>
        ))}
      </div>

      {/* Pemilih cabang (hanya saat lihat semua kelas & >1 cabang) */}
      {tab === 'all' && branches.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {branches.map((b) => (
            <button key={b.id} onClick={() => setActiveId(b.id)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition ${
                b.id === activeId ? 'bg-copper-100 border-copper-200 text-copper-700 font-semibold' : 'bg-white border-sand text-ink/60'}`}>
              <Building2 size={14} /> {b.name}
            </button>
          ))}
        </div>
      )}

      {/* Filter tanggal & instruktur (saat lihat semua kelas) */}
      {tab === 'all' && (
        <div className="flex gap-2 items-end flex-wrap">
          <div><label className="label !mb-1 text-xs">Dari</label><input type="date" className="input !py-1.5" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></div>
          <button type="button" onClick={() => setRange({ ...range, to: range.from })} title="Samakan: Sampai = Dari (lihat 1 hari)"
            className="btn-ghost !px-2 !py-2 border border-sand text-copper-600 self-end"><ArrowRight size={16} /></button>
          <div><label className="label !mb-1 text-xs">Sampai</label><input type="date" className="input !py-1.5" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></div>
          <div className="min-w-[160px]"><label className="label !mb-1 text-xs">Instruktur</label>
            <select className="input !py-1.5" value={instructorId} onChange={(e) => setInstructorId(e.target.value)}>
              <option value="">Semua instruktur</option>
              {instructors.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-ink/40 py-10 text-center">Memuat…</div>
      ) : groups.length === 0 ? (
        <div className="card text-center text-ink/50 py-10">
          <CalendarDays className="mx-auto mb-2 text-ink/30" size={28} />
          {tab === 'mine' ? 'Belum ada kelas yang kamu booking.' : 'Belum ada jadwal kelas.'}
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(([day, list]) => (
            <div key={day}>
              <h2 className="font-display text-lg font-semibold mb-2 capitalize">{formatDayDate(day)}</h2>
              <div className="space-y-2">
                {list.map((s) => {
                  const mine = s.my_booking_status
                  const st = s.booking_state
                  return (
                    <div key={s.id} className="card flex items-center gap-4">
                      <div className="text-center shrink-0 w-16">
                        <div className="font-display text-lg font-semibold text-copper-700">{formatTime(s.start_time)}</div>
                        <div className="text-[11px] text-ink/40">{endTime(formatTime(s.start_time), s.duration_minutes)}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate">{s.title}</div>
                        <div className="text-xs text-ink/50 flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                          {s.instructor_name && <span className="inline-flex items-center gap-1"><UserRound size={12} />{s.instructor_name}</span>}
                          {s.room && <span className="inline-flex items-center gap-1"><MapPin size={12} />{s.room}</span>}
                          <span className="inline-flex items-center gap-1"><Users size={12} />{s.booked_count}/{s.capacity}</span>
                          {tab === 'mine' && s.branch_name && <span className="inline-flex items-center gap-1 text-copper-600"><Building2 size={12} />{s.branch_name}</span>}
                        </div>
                        {/* Status jendela booking */}
                        {!mine && st === 'not_open' && <div className="text-[11px] text-ink/45 mt-1 inline-flex items-center gap-1"><Clock size={11} /> Dibuka {openLabel(s.booking_opens_at)}</div>}
                        {!mine && st === 'open' && <div className="text-[11px] text-copper-600 mt-1">Sisa {s.slots_remaining} slot</div>}
                        {!mine && st === 'full' && <div className="text-[11px] text-clay-dark mt-1">{s.can_book ? 'Penuh — bisa gabung waitlist' : 'Penuh — kelas terkunci'}</div>}
                        {!mine && st === 'closed' && <div className="text-[11px] text-ink/40 mt-1">Booking ditutup</div>}
                      </div>
                      <div className="shrink-0">
                        {mine === 'booked' || mine === 'waitlist' ? (
                          <div className="text-right flex flex-col items-end gap-1">
                            {mine === 'waitlist'
                              ? <span className="text-xs rounded-full px-3 py-1.5 bg-clay/10 text-clay-dark font-medium">Waitlist</span>
                              : <span className="inline-flex items-center gap-1 text-xs rounded-full px-3 py-1.5 bg-copper-100 text-copper-700 font-medium"><Check size={13} /> Terdaftar</span>}
                            {s.my_can_cancel && s.my_booking_id
                              ? <div className="flex items-center gap-2">
                                  <button onClick={() => setRescheduleFrom(s)}
                                    className="text-[11px] text-copper-700 hover:underline inline-flex items-center gap-0.5"><Repeat size={11} /> Pindah jadwal</button>
                                  <span className="text-ink/20">·</span>
                                  <button onClick={() => { if (confirm('Batalkan booking sesi ini?')) cancelBooking.mutate(s.my_booking_id!) }} disabled={cancelBooking.isPending}
                                    className="text-[11px] text-clay-dark hover:underline">Batalkan</button>
                                </div>
                              : <span className="text-[10px] text-ink/35 inline-flex items-center gap-0.5"><Clock size={10} /> Terkunci (&lt;12 jam)</span>}
                          </div>
                        ) : st === 'open' ? (
                          <button onClick={() => book.mutate(s.id)} disabled={book.isPending}
                            className="btn-primary !px-4 !py-1.5">
                            {book.isPending ? <Loader2 size={15} className="animate-spin" /> : 'Booking'}
                          </button>
                        ) : st === 'full' ? (
                          s.can_book ? (
                            <button onClick={() => book.mutate(s.id)} disabled={book.isPending}
                              className="btn-ghost !px-3 !py-1.5 border border-sand">Gabung waitlist</button>
                          ) : (
                            <span className="text-xs rounded-full px-3 py-1.5 bg-sand text-ink/50 font-medium">Penuh</span>
                          )
                        ) : st === 'not_open' ? (
                          <button disabled className="btn-ghost !px-3 !py-1.5 border border-sand opacity-50 cursor-not-allowed">Belum dibuka</button>
                        ) : (
                          <span className="text-xs text-ink/40">{st === 'closed' ? 'Ditutup' : '—'}</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-ink/40 flex items-center gap-1"><Clock size={12} /> Booking bisa dibatalkan/dipindah selama lebih dari 12 jam sebelum kelas mulai.</p>

      {rescheduleFrom && (
        <RescheduleModal
          from={rescheduleFrom}
          branchId={rescheduleFrom.branch_id ?? activeId}
          onClose={() => setRescheduleFrom(null)}
          onPick={(new_session_id) => reschedule.mutate({ booking_id: rescheduleFrom.my_booking_id!, new_session_id })}
          pending={reschedule.isPending}
        />
      )}
    </div>
  )
}

function RescheduleModal({ from, branchId, onClose, onPick, pending }: {
  from: ClassSession
  branchId?: string
  onClose: () => void
  onPick: (sessionId: string) => void
  pending: boolean
}) {
  const { data: sessions, isLoading } = useQuery({
    queryKey: ['reschedule-sessions', branchId, todayISO()],
    enabled: !!branchId,
    queryFn: async () =>
      (await api.get<ClassSession[]>('/schedule/sessions', {
        params: { branch_id: branchId, from: todayISO(), to: plusDays(21) },
      })).data,
  })
  const options = (sessions ?? []).filter((s) => s.id !== from.id && s.can_book && s.booking_state === 'open')
  const groups = groupByDate(options)

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-sand">
          <div>
            <h3 className="font-display font-semibold">Pindah jadwal</h3>
            <p className="text-xs text-ink/50">Dari {formatDayDate(from.session_date)} · {formatTime(from.start_time)}</p>
          </div>
          <button onClick={onClose} className="btn-ghost !p-1.5"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <div className="text-center text-ink/40 py-8">Memuat kelas…</div>
          ) : groups.length === 0 ? (
            <div className="text-center text-ink/50 py-8">Tidak ada kelas lain yang bisa dipilih saat ini.</div>
          ) : (
            groups.map(([day, list]) => (
              <div key={day}>
                <h4 className="text-xs font-semibold text-ink/50 mb-1.5 capitalize">{formatDayDate(day)}</h4>
                <div className="space-y-1.5">
                  {list.map((s) => (
                    <button key={s.id} disabled={pending} onClick={() => onPick(s.id)}
                      className="w-full text-left card !p-3 flex items-center gap-3 hover:border-copper-300 disabled:opacity-50">
                      <div className="text-center shrink-0 w-14">
                        <div className="font-display font-semibold text-copper-700">{formatTime(s.start_time)}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{s.title}</div>
                        <div className="text-[11px] text-ink/50 flex flex-wrap gap-x-2">
                          {s.instructor_name && <span>{s.instructor_name}</span>}
                          <span>Sisa {s.slots_remaining} slot</span>
                        </div>
                      </div>
                      {pending ? <Loader2 size={16} className="animate-spin text-copper-600" /> : <ArrowRight size={16} className="text-copper-500" />}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
