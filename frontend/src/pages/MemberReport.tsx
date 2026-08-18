import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '@/services/api'
import { waLink, formatDate } from '@/utils/format'
import { CATEGORY_LABEL } from '@/types'
import type { MemberCategory } from '@/types'
import { Users, UserCheck, UserPlus, AlarmClock, MessageCircle, ChevronRight } from 'lucide-react'

interface NeedRenewal {
  member_id: string
  full_name: string
  phone?: string | null
  category?: MemberCategory | null
  expires_at: string
  days_left: number
  status: 'expiring' | 'expired'
}
interface Report {
  active_total: number
  inactive_total: number
  by_category: Record<string, number>
  new_this_month: number
  need_renewal: NeedRenewal[]
}

export default function MemberReport() {
  const [within, setWithin] = useState(14)
  const { data, isLoading } = useQuery({
    queryKey: ['member-report', within],
    queryFn: async () => (await api.get<Report>('/reports/members', { params: { within_days: within } })).data,
  })

  const kpis = data ? [
    { label: 'Member aktif', value: data.active_total, icon: UserCheck, accent: true },
    { label: 'Baru bulan ini', value: data.new_this_month, icon: UserPlus },
    { label: 'Non-aktif', value: data.inactive_total, icon: Users },
    { label: 'Perlu perpanjang', value: data.need_renewal.length, icon: AlarmClock },
  ] : []

  const cats: [string, number][] = data
    ? (['bulanan', 'private', 'per_datang'] as const).map((k) => [k, data.by_category[k] ?? 0])
    : []

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold">Laporan Member</h1>
        <p className="text-ink/50 text-sm">Kesehatan basis member & daftar yang perlu di-follow-up untuk perpanjang.</p>
      </div>

      {isLoading || !data ? <div className="text-ink/40 py-10 text-center">Memuat…</div> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {kpis.map((k) => (
              <div key={k.label} className={`card ${k.accent ? 'bg-copper-50 border-copper-100' : ''}`}>
                <k.icon size={18} className={k.accent ? 'text-copper-600' : 'text-ink/40'} />
                <div className={`font-display text-2xl font-semibold mt-2 ${k.accent ? 'text-copper-700' : ''}`}>{k.value}</div>
                <div className="text-xs text-ink/50 mt-0.5">{k.label}</div>
              </div>
            ))}
          </div>

          <div className="card">
            <h2 className="font-semibold mb-2 text-sm">Member aktif per kategori</h2>
            <div className="flex flex-wrap gap-2">
              {cats.map(([k, v]) => (
                <span key={k} className="inline-flex items-center gap-2 rounded-full bg-sand px-3 py-1.5 text-sm">
                  {CATEGORY_LABEL[k as MemberCategory]} <b className="text-copper-700">{v}</b>
                </span>
              ))}
            </div>
          </div>

          {/* Perlu perpanjang */}
          <div>
            <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
              <h2 className="font-display text-lg font-semibold flex items-center gap-2"><AlarmClock size={18} className="text-clay-dark" /> Perlu Perpanjang</h2>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-ink/50">Ambang</span>
                <select className="input !py-1.5 !w-auto" value={within} onChange={(e) => setWithin(Number(e.target.value))}>
                  <option value={7}>7 hari</option>
                  <option value={14}>14 hari</option>
                  <option value={30}>30 hari</option>
                  <option value={60}>60 hari</option>
                </select>
              </div>
            </div>

            <div className="card !p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-ink/45 text-xs uppercase tracking-wide border-b border-sand">
                      <th className="font-semibold px-4 py-3">Member</th>
                      <th className="font-semibold px-4 py-3 hidden sm:table-cell">Kategori</th>
                      <th className="font-semibold px-4 py-3">Kedaluwarsa</th>
                      <th className="font-semibold px-4 py-3">Sisa</th>
                      <th className="font-semibold px-4 py-3">WA</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.need_renewal.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-10 text-center text-ink/40">Tidak ada member yang perlu perpanjang dalam {within} hari 🎉</td></tr>
                    ) : data.need_renewal.map((m) => (
                      <tr key={m.member_id} className="border-b border-sand/60 last:border-0 hover:bg-sand/40 transition">
                        <td className="px-4 py-3 font-semibold text-ink">{m.full_name}</td>
                        <td className="px-4 py-3 text-ink/60 hidden sm:table-cell">{m.category ? CATEGORY_LABEL[m.category] : '—'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{formatDate(m.expires_at)}</td>
                        <td className="px-4 py-3">
                          {m.status === 'expired'
                            ? <span className="text-xs rounded-full px-2 py-0.5 bg-sand text-ink/60">Sudah lewat {Math.abs(m.days_left)}h</span>
                            : <span className={`text-xs rounded-full px-2 py-0.5 ${m.days_left <= 3 ? 'bg-clay/15 text-clay-dark' : 'bg-copper-50 text-copper-700'}`}>{m.days_left} hari lagi</span>}
                        </td>
                        <td className="px-4 py-3">
                          {m.phone
                            ? <a href={waLink(m.phone)!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-copper-700 hover:underline"><MessageCircle size={14} /> Follow-up</a>
                            : <span className="text-ink/30 text-xs">—</span>}
                        </td>
                        <td className="px-2"><Link to={`/member/${m.member_id}`} className="text-ink/30 hover:text-copper-600"><ChevronRight size={16} /></Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
