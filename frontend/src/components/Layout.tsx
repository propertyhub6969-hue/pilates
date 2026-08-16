import { useState } from 'react'
import { Outlet, NavLink, Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { ROLE_LABEL, isStaff, type UserRole } from '@/types'
import Brand from '@/components/Brand'
import {
  LogOut, LayoutDashboard, CalendarDays, Users, Wallet, Package,
  ChevronDown, UserRound, Settings as SettingsIcon, Menu, X,
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
  const { user } = useAuth()
  // Staf (back office) → sidebar; member → mobile-first top/bottom nav
  return isStaff(user?.role) ? <StaffShell /> : <MemberShell />
}

/* ─────────────── BACK OFFICE: SIDEBAR ─────────────── */
function StaffShell() {
  const { user, logout } = useAuth()
  const [drawer, setDrawer] = useState(false)
  const loc = useLocation()

  const SidebarBody = (
    <>
      <div className="h-16 flex items-center px-5 border-b border-sand">
        <Link to="/" onClick={() => setDrawer(false)}><Brand size="sm" imgClassName="!h-9" /></Link>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-ink/35">Menu</p>
        {NAV.map((n) => (
          <SideLink key={n.to} item={n} onClick={() => setDrawer(false)} />
        ))}
        <p className="px-3 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-ink/35">Studio</p>
        <SideLink item={{ icon: SettingsIcon, label: 'Pengaturan', short: 'Set', to: '/pengaturan', roles: 'staff' }} onClick={() => setDrawer(false)} />
        <SideLink item={{ icon: UserRound, label: 'Profil', short: 'Profil', to: '/profil', roles: 'all' }} onClick={() => setDrawer(false)} />
      </nav>
      <div className="p-3 border-t border-sand">
        <div className="flex items-center gap-3 px-2 py-2">
          <span className="grid place-items-center w-9 h-9 rounded-full bg-copper-100 text-copper-700 shrink-0"><UserRound size={17} /></span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold truncate">{user?.full_name}</div>
            <div className="text-xs text-ink/50">{user && ROLE_LABEL[user.role as UserRole]}</div>
          </div>
          <button onClick={logout} className="btn-ghost !px-2 !py-2 text-clay-dark" title="Keluar"><LogOut size={17} /></button>
        </div>
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-cream">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex flex-col fixed inset-y-0 left-0 w-60 bg-white/70 backdrop-blur border-r border-sand z-30">
        {SidebarBody}
      </aside>

      {/* Drawer mobile */}
      {drawer && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-cream flex flex-col shadow-card">
            <button onClick={() => setDrawer(false)} className="absolute top-4 right-3 btn-ghost !px-2 !py-2"><X size={18} /></button>
            {SidebarBody}
          </aside>
        </div>
      )}

      {/* Konten */}
      <div className="lg:pl-60">
        {/* Topbar mobile */}
        <header className="lg:hidden sticky top-0 z-20 h-16 flex items-center justify-between px-4 bg-cream/85 backdrop-blur border-b border-sand">
          <button onClick={() => setDrawer(true)} className="btn-ghost !px-2"><Menu size={20} /></button>
          <Brand size="sm" imgClassName="!h-9" />
          <button onClick={logout} className="btn-ghost !px-2 text-clay-dark"><LogOut size={18} /></button>
        </header>

        <main key={loc.pathname} className="max-w-5xl mx-auto px-4 lg:px-8 py-6 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function SideLink({ item, onClick }: { item: NavItem; onClick?: () => void }) {
  return (
    <NavLink to={item.to} end={item.to === '/'} onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
          isActive ? 'bg-copper-100 text-copper-700' : 'text-ink/65 hover:bg-sand'}`}>
      <item.icon size={18} /> {item.label}
    </NavLink>
  )
}

/* ─────────────── MEMBER: TOP + BOTTOM NAV (mobile-first) ─────────────── */
function MemberShell() {
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const items = NAV.filter((n) => n.roles === 'all')

  return (
    <div className="min-h-screen bg-cream">
      <header className="sticky top-0 z-20 bg-cream/80 backdrop-blur border-b border-sand">
        <div className="mx-auto max-w-5xl px-4 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="shrink-0"><Brand size="sm" imgClassName="!h-10" /></Link>

          <nav className="hidden sm:flex items-center gap-1 flex-1 justify-center">
            {items.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === '/'}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1.5 transition ${
                    isActive ? 'bg-copper-100 text-copper-700' : 'text-ink/60 hover:bg-sand'}`}>
                <n.icon size={16} /> {n.label}
              </NavLink>
            ))}
          </nav>

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
                  <button onClick={logout} className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-sand w-full text-left text-clay-dark">
                    <LogOut size={16} /> Keluar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6"><Outlet /></div>

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
