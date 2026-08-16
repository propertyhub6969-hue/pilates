import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '@/services/api'
import { useAuth } from '@/context/AuthContext'
import { ROLE_LABEL, isStaff, STATUS_LABEL } from '@/types'
import type { MemberDetail, Page, User } from '@/types'
import { formatRupiah, formatDate } from '@/utils/format'
import {
  CalendarDays, Users, Wallet, Infinity as InfinityIcon, Sparkles, ShoppingBag,
} from 'lucide-react'

function MemberHome() {
  const { data: m } = useQuery({
    queryKey: ['me-detail'],
    queryFn: async () => (await api.get<MemberDetail>('/members/me')).data,
  })
  const active = m?.packages.filter((p) => p.status === 'active') ?? []

  return (
    <div className="space-y-5">
      <div className="rounded-xl2 bg-sage-600 text-white p-6">
        <p className="text-white/70 text-sm">Sisa kuota kamu</p>
        <div className="font-display text-5xl font-semibold mt-1">
          {m?.has_unlimited ? <span className="inline-flex items-center gap-2"><InfinityIcon size={44} /> Unlimited</span> : (m?.active_sessions_remaining ?? 0)}
        </div>
        <p className="text-white/60 text-sm mt-2">sesi tersisa & siap dipakai</p>
      </div>

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
            <div className="card text-ink/50 text-sm text-center">
              Belum ada paket aktif. Hubungi admin studio untuk membeli paket.
            </div>
          )}
        </div>
      </div>

      <div className="card bg-sage-50 border-sage-100 flex items-start gap-3">
        <CalendarDays className="text-sage-600 shrink-0 mt-0.5" size={20} />
        <p className="text-sm text-ink/60">Booking kelas dari HP akan hadir di <b>Fase 3</b>. Nantikan ya! 🧘</p>
      </div>
    </div>
  )
}

function StaffHome() {
  const { data: members } = useQuery({
    queryKey: ['count', 'member'],
    queryFn: async () => (await api.get<Page<User>>('/members', { params: { role: 'member', limit: 1 } })).data,
  })
  const { data: pending } = useQuery({
    queryKey: ['count', 'pending'],
    queryFn: async () => (await api.get<Page<unknown>>('/payments', { params: { status: 'pending', limit: 1 } })).data,
  })

  const stats = [
    { label: 'Total Member', value: members?.total ?? '…', to: '/member', icon: Users },
    { label: 'Pembayaran Menunggu', value: pending?.total ?? '…', to: '/pembayaran', icon: Wallet },
  ]

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {stats.map((s) => (
        <Link key={s.label} to={s.to} className="card flex items-center gap-4 hover:shadow-card transition">
          <span className="grid place-items-center w-12 h-12 rounded-xl bg-sand text-sage-600"><s.icon size={22} /></span>
          <div>
            <div className="text-sm text-ink/50">{s.label}</div>
            <div className="font-display text-2xl font-semibold">{s.value}</div>
          </div>
        </Link>
      ))}
      <div className="card sm:col-span-2 bg-sage-50 border-sage-100 flex items-start gap-3">
        <Sparkles className="text-sage-600 shrink-0 mt-0.5" size={20} />
        <p className="text-sm text-ink/60">
          <b>Fase 2 aktif:</b> kelola paket, member/instruktur, jual paket & pembayaran.
          Jadwal & booking menyusul di Fase 3.
        </p>
      </div>
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
