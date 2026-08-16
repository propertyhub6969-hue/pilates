import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '@/services/api'
import { useAuth } from '@/context/AuthContext'
import { ROLE_LABEL, isStaff } from '@/types'
import type { MemberDetail, MyBooking } from '@/types'
import { formatRupiah, formatDate, formatDayDate, formatTime } from '@/utils/format'
import {
  CalendarDays, Users, Wallet, Infinity as InfinityIcon, ShoppingBag,
  TrendingUp, Clock, UserRound,
} from 'lucide-react'

interface DashboardSummary {
  members_active: number
  revenue_month: number
  payments_pending: number
  attendance_rate_30d: number
  today_sessions: { id: string; title: string; start_time: string; booked_count: number; capacity: number; status: string }[]
}

function StaffHome() {
  const { data } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => (await api.get<DashboardSummary>('/reports/dashboard')).data,
  })

  const kpis = [
    { label: 'Member aktif', value: data?.members_active ?? '…', icon: Users, to: '/member' },
    { label: 'Pendapatan bulan ini', value: data ? formatRupiah(data.revenue_month) : '…', icon: TrendingUp, to: '/pembayaran', accent: true },
    { label: 'Pembayaran menunggu', value: data?.payments_pending ?? '…', icon: Wallet, to: '/pembayaran' },
    { label: 'Kehadiran (30 hari)', value: data ? `${Math.round(data.attendance_rate_30d * 100)}%` : '…', icon: CalendarDays, to: '/jadwal' },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <Link key={k.label} to={k.to} className={`card hover:shadow-card transition ${k.accent ? 'bg-sage-50 border-sage-100' : ''}`}>
            <k.icon size={18} className={k.accent ? 'text-sage-600' : 'text-ink/40'} />
            <div className={`font-display text-2xl font-semibold mt-2 ${k.accent ? 'text-sage-700' : ''}`}>{k.value}</div>
            <div className="text-xs text-ink/50 mt-0.5">{k.label}</div>
          </Link>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-display text-lg font-semibold">Kelas hari ini</h2>
          <Link to="/jadwal" className="text-sm text-sage-700 font-semibold">Semua jadwal →</Link>
        </div>
        <div className="space-y-2">
          {data?.today_sessions.map((s) => (
            <Link key={s.id} to="/jadwal" className={`card flex items-center gap-4 hover:shadow-card transition ${s.status === 'cancelled' ? 'opacity-50' : ''}`}>
              <div className="font-display text-lg font-semibold text-sage-700 w-14">{s.start_time}</div>
              <div className="flex-1 font-semibold truncate">{s.title}{s.status === 'cancelled' && <span className="text-clay text-xs"> (batal)</span>}</div>
              <div className="inline-flex items-center gap-1 text-sm text-ink/60"><Users size={14} />{s.booked_count}/{s.capacity}</div>
            </Link>
          ))}
          {data && data.today_sessions.length === 0 && (
            <div className="card text-ink/50 text-sm text-center py-6">Tidak ada kelas hari ini.</div>
          )}
        </div>
      </div>
    </div>
  )
}

function MemberHome() {
  const { data: m } = useQuery({
    queryKey: ['me-detail'],
    queryFn: async () => (await api.get<MemberDetail>('/members/me')).data,
  })
  const { data: bookings } = useQuery({
    queryKey: ['my-bookings'],
    queryFn: async () => (await api.get<MyBooking[]>('/bookings/me')).data,
  })
  const active = m?.packages.filter((p) => p.status === 'active') ?? []
  const next = bookings?.[0]

  return (
    <div className="space-y-5">
      <div className="rounded-xl2 bg-sage-600 text-white p-6">
        <p className="text-white/70 text-sm">Sisa kuota kamu</p>
        <div className="font-display text-5xl font-semibold mt-1">
          {m?.has_unlimited ? <span className="inline-flex items-center gap-2"><InfinityIcon size={44} /> Unlimited</span> : (m?.active_sessions_remaining ?? 0)}
        </div>
        <p className="text-white/60 text-sm mt-2">sesi tersisa &amp; siap dipakai</p>
      </div>

      {next && (
        <Link to="/jadwal" className="card flex items-center gap-4 hover:shadow-card transition border-sage-100">
          <span className="grid place-items-center w-12 h-12 rounded-xl bg-sage-50 text-sage-600 shrink-0"><Clock size={22} /></span>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-ink/50">Kelas berikutnya {next.status === 'waitlist' && '· waitlist'}</div>
            <div className="font-semibold truncate">{next.session.title}</div>
            <div className="text-sm text-ink/55 capitalize">{formatDayDate(next.session.session_date)} · {formatTime(next.session.start_time)}
              {next.session.instructor_name && <span className="inline-flex items-center gap-1"> · <UserRound size={12} />{next.session.instructor_name}</span>}
            </div>
          </div>
        </Link>
      )}

      <div>
        <h2 className="font-display text-lg font-semibold mb-2 flex items-center gap-2"><ShoppingBag size={18} /> Paket Aktif</h2>
        <div className="space-y-2">
          {active.map((p) => (
            <div key={p.id} className="card flex items-center justify-between">
              <div>
                <div className="font-semibold">{p.package_name}</div>
                <div className="text-xs text-ink/50">{p.expires_at ? `Berlaku s/d ${formatDate(p.expires_at)}` : 'Tanpa kedaluwarsa'}</div>
              </div>
              <div className="text-sm font-semibold text-sage-700">
                {p.is_unlimited ? <InfinityIcon size={16} className="inline" /> : `${p.sessions_remaining}/${p.sessions_total}`}
              </div>
            </div>
          ))}
          {active.length === 0 && (
            <div className="card text-ink/50 text-sm text-center">Belum ada paket aktif. Hubungi admin studio untuk membeli paket.</div>
          )}
        </div>
      </div>

      <Link to="/jadwal" className="card bg-sage-50 border-sage-100 flex items-center gap-3 hover:shadow-card transition">
        <CalendarDays className="text-sage-600 shrink-0" size={20} />
        <p className="text-sm text-ink/70 flex-1">Lihat jadwal kelas &amp; booking sesimu →</p>
      </Link>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  return (
    <div className="space-y-6">
      <div>
        <p className="text-ink/50 text-sm">{user && ROLE_LABEL[user.role]}</p>
        <h1 className="font-display text-3xl font-semibold">Halo, {user?.full_name?.split(' ')[0]} 👋</h1>
      </div>
      {isStaff(user?.role) ? <StaffHome /> : <MemberHome />}
    </div>
  )
}
