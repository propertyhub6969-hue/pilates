import { useAuth } from '@/context/AuthContext'
import { ROLE_LABEL } from '@/types'
import { CalendarDays, Users, Wallet, CheckCircle2, Sparkles } from 'lucide-react'

const MODULES = [
  { icon: CalendarDays, title: 'Jadwal & Booking', desc: 'Template kelas berulang, generate sesi, booking member + waitlist.', phase: 'Fase 3' },
  { icon: Wallet, title: 'Paket & Pembayaran', desc: 'Katalog paket, beli paket, catat pembayaran, kuota sesi.', phase: 'Fase 2' },
  { icon: Users, title: 'Member & Instruktur', desc: 'Kelola data member, instruktur, dan hak akses.', phase: 'Fase 2' },
  { icon: CheckCircle2, title: 'Check-in & Absensi', desc: 'Check-in peserta, potong kuota, laporan kehadiran.', phase: 'Fase 4' },
]

export default function Dashboard() {
  const { user } = useAuth()

  return (
    <div className="space-y-6">
      <div>
        <p className="text-ink/50 text-sm">{user && ROLE_LABEL[user.role]}</p>
        <h1 className="font-display text-3xl font-semibold">Halo, {user?.full_name?.split(' ')[0]} 👋</h1>
      </div>

      <div className="card bg-sage-50 border-sage-100 flex items-start gap-3">
        <Sparkles className="text-sage-600 shrink-0 mt-0.5" size={20} />
        <div>
          <p className="font-semibold text-sage-700">Fondasi siap.</p>
          <p className="text-sm text-ink/60">
            Login, peran (owner/admin/instruktur/member), dan struktur data inti sudah terpasang.
            Modul di bawah akan diaktifkan bertahap.
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {MODULES.map((m) => (
          <div key={m.title} className="card flex items-start gap-4">
            <span className="grid place-items-center w-11 h-11 rounded-xl bg-sand text-sage-600 shrink-0">
              <m.icon size={22} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-ink">{m.title}</h3>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-clay bg-clay/10 rounded-full px-2 py-0.5">
                  {m.phase}
                </span>
              </div>
              <p className="text-sm text-ink/55 mt-1">{m.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
