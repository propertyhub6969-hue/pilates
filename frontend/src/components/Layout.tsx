import { Outlet } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { ROLE_LABEL } from '@/types'
import { LogOut, LayoutDashboard, CalendarDays, Users, Wallet } from 'lucide-react'

// Nav placeholder — item aktif per peran akan diisi di fase berikutnya.
const NAV = [
  { icon: LayoutDashboard, label: 'Dashboard', to: '/', soon: false },
  { icon: CalendarDays, label: 'Jadwal & Booking', to: '/jadwal', soon: true },
  { icon: Users, label: 'Member', to: '/member', soon: true },
  { icon: Wallet, label: 'Paket & Pembayaran', to: '/paket', soon: true },
]

export default function Layout() {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-cream/80 backdrop-blur border-b border-sand">
        <div className="mx-auto max-w-5xl px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid place-items-center w-9 h-9 rounded-full bg-sage-600 text-white font-display font-semibold">R</span>
            <span className="font-display text-lg font-semibold tracking-tight">Reformer Your Body</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right leading-tight hidden sm:block">
              <div className="text-sm font-semibold">{user?.full_name}</div>
              <div className="text-xs text-ink/50">{user && ROLE_LABEL[user.role]}</div>
            </div>
            <button onClick={logout} className="btn-ghost !px-3" title="Keluar">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </div>

      {/* Bottom nav (mobile-first) */}
      <nav className="fixed bottom-0 inset-x-0 z-20 bg-white/95 backdrop-blur border-t border-sand sm:hidden">
        <div className="grid grid-cols-4">
          {NAV.map((n) => (
            <div key={n.label} className="flex flex-col items-center py-2.5 text-ink/60">
              <n.icon size={20} />
              <span className="text-[10px] mt-1">{n.label.split(' ')[0]}</span>
            </div>
          ))}
        </div>
      </nav>
      <div className="h-16 sm:hidden" />
    </div>
  )
}
