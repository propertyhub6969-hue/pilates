import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '@/services/api'
import { useAuth } from '@/context/AuthContext'
import { useBranch } from '@/context/BranchContext'
import { ROLE_LABEL, isStaff } from '@/types'
import type { MemberDetail, MyBooking } from '@/types'
import { formatRupiah, formatDate, formatDayDate, formatTime } from '@/utils/format'
import {
  CalendarDays, Users, Wallet, Infinity as InfinityIcon, ShoppingBag,
  TrendingUp, Clock, UserRound, Landmark, Upload, Loader2, Check, Zap, CircleDollarSign,
} from 'lucide-react'

/* ═══════════════ STAF ═══════════════ */
interface DashboardSummary {
  members_active: number; revenue_month: number | null; payments_pending: number; attendance_rate_30d: number
  today_sessions: { id: string; title: string; start_time: string; booked_count: number; capacity: number; status: string }[]
}
function StaffHome() {
  const { activeId, activeBranch } = useBranch()
  const { data } = useQuery({
    queryKey: ['dashboard', activeId],
    queryFn: async () => (await api.get<DashboardSummary>('/reports/dashboard', { params: activeId ? { branch_id: activeId } : {} })).data,
  })
  // Pendapatan hanya tampil bila server mengirimnya (owner). Non-owner: null → sembunyikan.
  const showRevenue = data ? data.revenue_month != null : true
  const kpis = [
    { label: 'Member aktif', value: data?.members_active ?? '…', icon: Users, to: '/member' },
    ...(showRevenue ? [{ label: 'Pendapatan bulan ini', value: data ? formatRupiah(data.revenue_month ?? 0) : '…', icon: TrendingUp, to: '/laporan', accent: true }] : []),
    { label: 'Pembayaran menunggu', value: data?.payments_pending ?? '…', icon: Wallet, to: '/pembayaran' },
    { label: 'Kehadiran (30 hari)', value: data ? `${Math.round(data.attendance_rate_30d * 100)}%` : '…', icon: CalendarDays, to: '/jadwal' },
  ]
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <Link key={k.label} to={k.to} className={`card hover:shadow-card transition ${k.accent ? 'bg-copper-50 border-copper-100' : ''}`}>
            <k.icon size={18} className={k.accent ? 'text-copper-600' : 'text-ink/40'} />
            <div className={`font-display text-2xl font-semibold mt-2 ${k.accent ? 'text-copper-700' : ''}`}>{k.value}</div>
            <div className="text-xs text-ink/50 mt-0.5">{k.label}</div>
          </Link>
        ))}
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-display text-lg font-semibold">Kelas hari ini {activeBranch && <span className="text-ink/40 text-sm font-sans font-normal">· {activeBranch.name}</span>}</h2>
          <Link to="/jadwal" className="text-sm text-copper-700 font-semibold">Semua jadwal →</Link>
        </div>
        <div className="space-y-2">
          {data?.today_sessions.map((s) => (
            <Link key={s.id} to="/jadwal" className={`card flex items-center gap-4 hover:shadow-card transition ${s.status === 'cancelled' ? 'opacity-50' : ''}`}>
              <div className="font-display text-lg font-semibold text-copper-700 w-14">{s.start_time}</div>
              <div className="flex-1 font-semibold truncate">{s.title}{s.status === 'cancelled' && <span className="text-clay text-xs"> (batal)</span>}</div>
              <div className="inline-flex items-center gap-1 text-sm text-ink/60"><Users size={14} />{s.booked_count}/{s.capacity}</div>
            </Link>
          ))}
          {data && data.today_sessions.length === 0 && <div className="card text-ink/50 text-sm text-center py-6">Tidak ada kelas hari ini.</div>}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════ MEMBER ═══════════════ */
interface Pkg { id: string; name: string; is_unlimited: boolean; session_count?: number | null; price: number; description?: string | null }
interface Bank { name: string; bank_name?: string | null; account_number?: string | null }

function MemberHome() {
  const qc = useQueryClient()
  const { data: m } = useQuery({ queryKey: ['me-detail'], queryFn: async () => (await api.get<MemberDetail>('/members/me')).data })
  const { data: bookings } = useQuery({ queryKey: ['my-bookings'], queryFn: async () => (await api.get<MyBooking[]>('/bookings/me')).data })

  if (!m) return <div className="text-ink/40 py-10 text-center">Memuat…</div>

  const pending = m.payments.filter((p) => p.status === 'pending')
  const hasActive = m.packages.some((p) => p.status === 'active') || m.has_unlimited
  const enrolled = hasActive || m.member_category === 'per_datang'

  return (
    <div className="space-y-5">
      {!enrolled && pending.length === 0 && <EnrollCard qc={qc} />}
      {pending.length > 0 && <PendingSection payments={pending} m={m} qc={qc} />}
      {enrolled && <ActiveMemberView m={m} bookings={bookings} />}
    </div>
  )
}

function ActiveMemberView({ m, bookings }: { m: MemberDetail; bookings?: MyBooking[] }) {
  const active = m.packages.filter((p) => p.status === 'active')
  const next = bookings?.[0]
  const perDatang = m.member_category === 'per_datang' && active.length === 0 && !m.has_unlimited
  return (
    <>
      {perDatang ? (
        <div className="rounded-xl2 bg-copper-600 text-white p-6">
          <p className="text-white/70 text-sm inline-flex items-center gap-1"><Zap size={14} /> Member Per Datang</p>
          <div className="font-display text-2xl font-semibold mt-1">Bayar tiap kali datang</div>
          <p className="text-white/60 text-sm mt-2">Booking kelas dari menu Jadwal — tagihan dibuat otomatis tiap booking.</p>
        </div>
      ) : (
        <div className="rounded-xl2 bg-copper-600 text-white p-6">
          <p className="text-white/70 text-sm">Sisa kuota kamu</p>
          <div className="font-display text-5xl font-semibold mt-1">
            {m.has_unlimited ? <span className="inline-flex items-center gap-2"><InfinityIcon size={44} /> Unlimited</span> : (m.active_sessions_remaining ?? 0)}
          </div>
          <p className="text-white/60 text-sm mt-2">sesi tersisa & siap dipakai</p>
        </div>
      )}

      {next && (
        <Link to="/jadwal" className="card flex items-center gap-4 hover:shadow-card transition border-copper-100">
          <span className="grid place-items-center w-12 h-12 rounded-xl bg-copper-50 text-copper-600 shrink-0"><Clock size={22} /></span>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-ink/50">Kelas berikutnya {next.status === 'waitlist' && '· waitlist'}</div>
            <div className="font-semibold truncate">{next.session.title}</div>
            <div className="text-sm text-ink/55 capitalize">{formatDayDate(next.session.session_date)} · {formatTime(next.session.start_time)}</div>
          </div>
        </Link>
      )}

      {active.length > 0 && (
        <div>
          <h2 className="font-display text-lg font-semibold mb-2 flex items-center gap-2"><ShoppingBag size={18} /> Paket Aktif</h2>
          <div className="space-y-2">
            {active.map((p) => (
              <div key={p.id} className="card flex items-center justify-between">
                <div>
                  <div className="font-semibold">{p.package_name}</div>
                  <div className="text-xs text-ink/50">{p.expires_at ? `Berlaku s/d ${formatDate(p.expires_at)}` : 'Tanpa kedaluwarsa'}</div>
                </div>
                <div className="text-sm font-semibold text-copper-700">{p.is_unlimited ? <InfinityIcon size={16} className="inline" /> : `${p.sessions_remaining}/${p.sessions_total}`}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Link to="/jadwal" className="card bg-copper-50 border-copper-100 flex items-center gap-3 hover:shadow-card transition">
        <CalendarDays className="text-copper-600 shrink-0" size={20} />
        <p className="text-sm text-ink/70 flex-1">Lihat jadwal kelas & booking sesimu →</p>
      </Link>
    </>
  )
}

function EnrollCard({ qc }: { qc: ReturnType<typeof useQueryClient> }) {
  const { data: packages } = useQuery({ queryKey: ['public-packages'], queryFn: async () => (await api.get<Pkg[]>('/public/packages')).data })
  const [plan, setPlan] = useState<string>('per_datang')
  const [error, setError] = useState('')
  const enroll = useMutation({
    mutationFn: async () => {
      const isDrop = plan === 'per_datang'
      return api.post('/members/me/enroll', { member_category: isDrop ? 'per_datang' : 'bulanan', package_id: isDrop ? undefined : plan })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me-detail'] }),
    onError: (e: any) => setError(e?.response?.data?.detail ?? 'Gagal'),
  })

  return (
    <div className="space-y-4">
      <div className="rounded-xl2 bg-copper-600 text-white p-6">
        <div className="font-display text-2xl font-semibold">Selamat datang! 🧘</div>
        <p className="text-white/70 mt-1">Pilih keanggotaanmu untuk mulai booking kelas.</p>
      </div>

      <div className="space-y-2">
        <PlanCard active={plan === 'per_datang'} onClick={() => setPlan('per_datang')} title="Per Datang (drop-in)"
          desc="Bayar tiap kali datang, tanpa paket." right={<Zap size={18} className="text-copper-600" />} />
        {(packages ?? []).map((p) => (
          <PlanCard key={p.id} active={plan === p.id} onClick={() => setPlan(p.id)} title={p.name}
            desc={(p.is_unlimited ? 'Unlimited' : `${p.session_count} sesi`) + (p.description ? ` · ${p.description}` : '')}
            right={<span className="font-display font-semibold text-copper-700 whitespace-nowrap">{formatRupiah(p.price)}</span>} />
        ))}
      </div>

      {error && <div className="text-sm text-clay-dark bg-clay/10 border border-clay/20 rounded-lg px-3 py-2">{error}</div>}
      <button onClick={() => { setError(''); enroll.mutate() }} disabled={enroll.isPending} className="btn-primary w-full">
        {enroll.isPending && <Loader2 size={16} className="animate-spin" />}
        Lanjutkan Pembayaran
      </button>
    </div>
  )
}

function PendingSection({ payments, m, qc }: { payments: MemberDetail['payments']; m: MemberDetail; qc: ReturnType<typeof useQueryClient> }) {
  const { data: banks } = useQuery({ queryKey: ['transfer-info'], queryFn: async () => (await api.get<Bank[]>('/finance/transfer-info')).data })
  const totalPending = payments.reduce((s, p) => s + p.amount, 0)

  return (
    <div className="space-y-4">
      <div className="rounded-xl2 bg-copper-600 text-white p-6">
        <p className="text-white/70 text-sm inline-flex items-center gap-1"><CircleDollarSign size={15} /> Selesaikan pembayaran</p>
        <div className="font-display text-3xl font-semibold mt-1">{formatRupiah(totalPending)}</div>
        <p className="text-white/60 text-sm mt-2">{payments.length} tagihan menunggu pembayaran</p>
      </div>

      <div className="card">
        <h3 className="font-semibold mb-2 flex items-center gap-2"><Landmark size={18} className="text-copper-600" /> Transfer ke</h3>
        <div className="space-y-2">
          {(banks ?? []).map((b, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg bg-sand/50 px-3 py-2">
              <div>
                <div className="font-semibold text-sm">{b.bank_name || b.name}</div>
                <div className="text-xs text-ink/50">a/n {b.name}</div>
              </div>
              <div className="font-mono font-semibold text-copper-700">{b.account_number || '—'}</div>
            </div>
          ))}
          {(!banks || banks.length === 0) && <div className="text-ink/40 text-sm">Info rekening belum diatur. Hubungi admin studio.</div>}
        </div>
      </div>

      {payments.map((p) => <PendingRow key={p.id} payment={p} m={m} qc={qc} />)}
    </div>
  )
}

function PendingRow({ payment, m, qc }: { payment: MemberDetail['payments'][number]; m: MemberDetail; qc: ReturnType<typeof useQueryClient> }) {
  const [proof, setProof] = useState<File | null>(null)
  const [error, setError] = useState('')
  const pkgName = m.packages.find((p) => p.id === payment.member_package_id)?.package_name
  const label = pkgName ?? payment.note ?? 'Pembayaran'

  const upload = useMutation({
    mutationFn: async () => {
      const fd = new FormData(); fd.append('file', proof as File)
      return api.post(`/payments/${payment.id}/proof`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me-detail'] }),
    onError: (e: any) => setError(e?.response?.data?.detail ?? 'Gagal mengunggah'),
  })

  return (
    <div className="card space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold truncate">{label}</div>
          <div className="text-xs text-ink/50">Menunggu pembayaran</div>
        </div>
        <div className="font-display text-lg font-semibold text-copper-700 whitespace-nowrap">{formatRupiah(payment.amount)}</div>
      </div>

      {payment.has_proof ? (
        <div className="flex items-center gap-2 text-sm text-copper-700 bg-copper-50 border border-copper-100 rounded-lg px-3 py-2">
          <Check size={16} /> Bukti terkirim — menunggu verifikasi admin.
        </div>
      ) : (
        <>
          <label className="flex items-center gap-2 input cursor-pointer text-ink/60 hover:border-copper-300">
            <Upload size={16} className="text-copper-600" />
            <span className="truncate">{proof ? proof.name : 'Pilih bukti transfer (gambar/PDF)…'}</span>
            <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setProof(e.target.files?.[0] ?? null)} />
          </label>
          {error && <div className="text-sm text-clay-dark bg-clay/10 border border-clay/20 rounded-lg px-3 py-2">{error}</div>}
          <button onClick={() => { setError(''); if (proof) upload.mutate() }} disabled={!proof || upload.isPending} className="btn-primary w-full">
            {upload.isPending && <Loader2 size={16} className="animate-spin" />} Kirim bukti
          </button>
        </>
      )}
    </div>
  )
}

function PlanCard({ active, onClick, title, desc, right }: { active: boolean; onClick: () => void; title: string; desc: string; right: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`w-full text-left rounded-xl border px-4 py-3 flex items-center gap-3 transition ${active ? 'border-copper-400 bg-copper-50 ring-2 ring-copper-100' : 'border-sand bg-white hover:border-copper-200'}`}>
      <span className={`grid place-items-center w-5 h-5 rounded-full border shrink-0 ${active ? 'bg-copper-600 border-copper-600 text-white' : 'border-sand'}`}>{active && <Check size={13} />}</span>
      <div className="flex-1 min-w-0"><div className="font-semibold text-sm">{title}</div><div className="text-xs text-ink/50 truncate">{desc}</div></div>
      {right}
    </button>
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
