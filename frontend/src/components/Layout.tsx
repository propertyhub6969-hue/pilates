import { Outlet, NavLink } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { ROLE_LABEL, isStaff, type UserRole } from '@/types'
import { LogOut, LayoutDashboard, CalendarDays, Users, Wallet, Package } from 'lucide-react'

interface NavItem { icon: any; label: string; short: string; to: string; roles: 'all' | 'staff'; soon?: boolean }

const NAV: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', short: 'Home', to: '/', roles: 'all' },
  { icon: CalendarDays, label: 'Jadwal', short: 'Jadwal', to: '/jadwal', roles: 'all', soon: true },
  { icon: Users, label: 'Member', short: 'Member', to: '/member', roles: 'staff' },
  { icon: Package, label: 'Paket', short: 'Paket', to: '/paket', roles: 'staff' },
  { icon: Wallet, label: 'Pembayaran', short: 'Bayar', to: '/pembayaran', roles: 'staff' },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const items = NAV.filter((n) => n.roles === 'all' || isStaff(user?.role))

  return (
    <div className="min-h-screen bg-cream">
      <header className="sticky top-0 z-20 bg-cream/80 backdrop-blur border-b border-sand">
        <div className="mx-auto max-w-5xl px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <span className="grid place-items-center w-9 h-9 rounded-full bg-sage-600 text-white font-display font-semibold">R</span>
            <span className="font-display text-lg font-semibold tracking-tight hidden sm:inline">Reformer Your Body</span>
          </div>

          {/* Nav desktop */}
          <nav className="hidden sm:flex items-center gap-1 flex-1 justify-center">
            {items.map((n) => (
              <NavItemLink key={n.to} item={n} />
            ))}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right leading-tight hidden sm:block">
              <div className="text-sm font-semibold">{user?.full_name}</div>
              <div className="text-xs text-ink/50">{user && ROLE_LABEL[user.role as UserRole]}</div>
            </div>
            <button onClick={logout} className="btn-ghost !px-3" title="Keluar"><LogOut size={18} /></button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </div>

      {/* Bottom nav mobile */}
      <nav className="fixed bottom-0 inset-x-0 z-20 bg-white/95 backdrop-blur border-t border-sand sm:hidden">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0,1fr))` }}>
          {items.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center py-2.5 ${isActive && !n.soon ? 'text-sage-600' : 'text-ink/50'} ${n.soon ? 'opacity-50' : ''}`}
              onClick={(e) => n.soon && e.preventDefault()}>
              <n.icon size={20} />
              <span className="text-[10px] mt-1">{n.short}</span>
            </NavLink>
          ))}
        </div>
      </nav>
      <div className="h-16 sm:hidden" />
    </div>
  )
}

function NavItemLink({ item }: { item: NavItem }) {
  if (item.soon) {
    return (
      <span className="px-3 py-1.5 rounded-full text-sm font-medium text-ink/30 cursor-default flex items-center gap-1.5">
        <item.icon size={16} /> {item.label}
      </span>
    )
  }
  return (
    <NavLink to={item.to} end={item.to === '/'}
      className={({ isActive }) =>
        `px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1.5 transition ${
          isActive ? 'bg-sage-100 text-sage-700' : 'text-ink/60 hover:bg-sand'}`}>
      <item.icon size={16} /> {item.label}
    </NavLink>
  )
}
