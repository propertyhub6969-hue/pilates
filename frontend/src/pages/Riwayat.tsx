import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api'
import { formatTime, formatDayDate } from '@/utils/format'
import { BOOKING_STATUS_LABEL } from '@/types'
import { CalendarDays } from 'lucide-react'

interface MyHistory { session_date: string; start_time: string; title: string; status: string }
const PAGE = 10

export default function Riwayat() {
  const [limit, setLimit] = useState(PAGE)
  const { data, isLoading } = useQuery({
    queryKey: ['my-history'],
    queryFn: async () => (await api.get<MyHistory[]>('/bookings/me/history')).data,
  })
  const hadir = (data ?? []).filter((h) => h.status === 'attended').length
  const tidak = (data ?? []).filter((h) => h.status === 'no_show').length

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-semibold flex items-center gap-2"><CalendarDays size={22} /> Riwayat Kehadiran</h1>

      {isLoading ? <div className="text-ink/40 py-10 text-center">Memuat…</div> : (data?.length ?? 0) === 0 ? (
        <div className="card text-center text-ink/50 py-10">
          <CalendarDays className="mx-auto mb-2 text-ink/30" size={28} />
          Belum ada riwayat kehadiran.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="card text-center bg-copper-50 border-copper-100">
              <div className="font-display text-3xl font-semibold text-copper-700">{hadir}</div>
              <div className="text-xs text-ink/50 mt-0.5">Hadir</div>
            </div>
            <div className="card text-center">
              <div className="font-display text-3xl font-semibold text-clay-dark">{tidak}</div>
              <div className="text-xs text-ink/50 mt-0.5">Tidak hadir</div>
            </div>
          </div>

          <div className="card !p-0 overflow-hidden divide-y divide-sand">
            {data!.slice(0, limit).map((h, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <span className="font-display font-semibold text-copper-700 w-12 shrink-0">{formatTime(h.start_time)}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{h.title}</div>
                  <div className="text-[11px] text-ink/45 capitalize">{formatDayDate(h.session_date)}</div>
                </div>
                <span className={`text-[10px] rounded-full px-2 py-0.5 shrink-0 ${h.status === 'attended' ? 'bg-copper-100 text-copper-700' : h.status === 'no_show' ? 'bg-clay/10 text-clay-dark' : 'bg-sand text-ink/50'}`}>
                  {BOOKING_STATUS_LABEL[h.status as keyof typeof BOOKING_STATUS_LABEL]}
                </span>
              </div>
            ))}
            {data!.length > limit && (
              <button onClick={() => setLimit((n) => n + PAGE)} className="w-full text-center text-sm text-copper-700 font-medium py-2.5 hover:bg-sand/40">
                Muat lebih ({data!.length - limit} lagi)
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
