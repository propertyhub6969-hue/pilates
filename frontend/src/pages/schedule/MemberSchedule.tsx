import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/services/api'
import { useBranch } from '@/context/BranchContext'
import type { ClassSession } from '@/types'
import { formatTime, formatDayDate } from '@/utils/format'
import { Clock, MapPin, UserRound, Users, Loader2, CalendarDays, Building2, Check } from 'lucide-react'

function endTime(start: string, mins: number): string {
  const [h, m] = start.split(':').map(Number)
  const d = new Date(2000, 0, 1, h, m + mins)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

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

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['sessions', tab, activeId],
    enabled: tab === 'mine' || !!activeId,
    queryFn: async () =>
      (await api.get<ClassSession[]>('/schedule/sessions', {
        params: tab === 'mine' ? { mine: true } : { branch_id: activeId },
      })).data,
  })

  const book = useMutation({
    mutationFn: async (session_id: string) => api.post('/bookings', { session_id }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sessions'] }); qc.invalidateQueries({ queryKey: ['me-detail'] }) },
    onError: (e: any) => alert(e?.response?.data?.detail ?? 'Gagal booking'),
  })

  const groups = groupByDate(sessions ?? [])

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
                        {!mine && st === 'full' && <div className="text-[11px] text-clay-dark mt-1">Penuh — bisa gabung waitlist</div>}
                        {!mine && st === 'closed' && <div className="text-[11px] text-ink/40 mt-1">Booking ditutup</div>}
                      </div>
                      <div className="shrink-0">
                        {mine === 'booked' || mine === 'waitlist' ? (
                          <div className="text-right">
                            {mine === 'waitlist'
                              ? <span className="text-xs rounded-full px-3 py-1.5 bg-clay/10 text-clay-dark font-medium">Waitlist</span>
                              : <span className="inline-flex items-center gap-1 text-xs rounded-full px-3 py-1.5 bg-copper-100 text-copper-700 font-medium"><Check size={13} /> Terdaftar</span>}
                          </div>
                        ) : st === 'open' ? (
                          <button onClick={() => book.mutate(s.id)} disabled={book.isPending}
                            className="btn-primary !px-4 !py-1.5">
                            {book.isPending ? <Loader2 size={15} className="animate-spin" /> : 'Booking'}
                          </button>
                        ) : st === 'full' ? (
                          <button onClick={() => book.mutate(s.id)} disabled={book.isPending}
                            className="btn-ghost !px-3 !py-1.5 border border-sand">Gabung waitlist</button>
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
      <p className="text-xs text-ink/40 flex items-center gap-1"><Clock size={12} /> Untuk membatalkan/mengubah booking, hubungi admin studio.</p>
    </div>
  )
}
