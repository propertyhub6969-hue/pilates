import { useState } from 'react'
import { Outlet, NavLink, Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { ROLE_LABEL, isStaff, type UserRole } from '@/types'
import Brand from '@/components/Brand'
import {
  LogOut, LayoutDashboard, CalendarDays, Users, Wallet, Package,
  ChevronDown, UserRound, Settings as SettingsIcon,
} from 'lucide-react'

interface NavItem { icon: any; label: string; short: string; to: string; roles: 'all' | 'staff' }

const NAV: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', short: 'Home', to: '/', roles: 'all' },
  { icon: CalendarDays, label: 'Jadwal', short: 'Jadwal', to: '/jadwal', roles: 'all' },
  { icon: Users, label: 'Member', short: 'Member', to: '/member', roles: 'staff' },
  { icon: Package, label: 'Paket', short: 'Paket', to: '/paket', roles: 'staff' },
  { icon: Wallet, label: 'Pembayaran', short: 'Bayar', to: '/pembayaran', roles: 'staff' },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const staff = isStaff(user?.role)
  const items = NAV.filter((n) => n.roles === 'all' || staff)

  return (
    <div className="min-h-screen bg-cream">
      <header className="sticky top-0 z-20 bg-cream/80 backdrop-blur border-b border-sand">
        <div className="mx-auto max-w-5xl px-4 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="shrink-0">
            <Brand size="sm" imgClassName="!h-10" />
          </Link>

          <nav className="hidden sm:flex items-center gap-1 flex-1 justify-center">
            {items.map((n) => <NavItemLink key={n.to} item={n} />)}
          </nav>

          {/* User menu */}
          <div className="relative shrink-0">
            <button onClick={() => setMenuOpen((v) => !v)} className="flex items-center gap-2 rounded-full hover:bg-sand px-2 py-1.5 transition">
              <span className="grid place-items-center w-8 h-8 rounded-full bg-copper-100 text-copper-700"><UserRound size={17} /></span>
              <span className="text-sm font-semibold hidden sm:block max-w-[120px] truncate">{user?.full_name}</span>
              <ChevronDown size={15} className="text-ink/40 hidden sm:block" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-card border border-sand py-1.5 z-20">
                  <div className="px-4 py-2 border-b border-sand">
                    <div className="text-sm font-semibold truncate">{user?.full_name}</div>
                    <div className="text-xs text-ink/50">{user && ROLE_LABEL[user.role as UserRole]}</div>
                  </div>
                  <Link to="/profil" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-sand">
                    <UserRound size={16} /> Profil
                  </Link>
                  {staff && (
                    <Link to="/pengaturan" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-sand">
                      <SettingsIcon size={16} /> Pengaturan
                    </Link>
                  )}
                  <button onClick={logout} className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-sand w-full text-left text-clay-dark">
                    <LogOut size={16} /> Keluar
                  </button>
                </div>
              </>
            )}
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
              className={({ isActive }) => `flex flex-col items-center py-2.5 ${isActive ? 'text-copper-600' : 'text-ink/50'}`}>
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
  return (
    <NavLink to={item.to} end={item.to === '/'}
      className={({ isActive }) =>
        `px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1.5 transition ${
          isActive ? 'bg-copper-100 text-copper-700' : 'text-ink/60 hover:bg-sand'}`}>
      <item.icon size={16} /> {item.label}
    </NavLink>
  )
}
