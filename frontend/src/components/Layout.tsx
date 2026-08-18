import { useState, useEffect } from 'react'
import { Outlet, NavLink, Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useBranch } from '@/context/BranchContext'
import { ROLE_LABEL, isStaff, isOwner, type UserRole } from '@/types'
import Brand from '@/components/Brand'
import NotificationBell from '@/components/NotificationBell'
import Avatar from '@/components/Avatar'
import {
  LogOut, LayoutDashboard, CalendarDays, Users, Wallet, Package,
  ChevronDown, UserRound, Settings as SettingsIcon, Menu, X, Building2, Plus,
  Coins, BarChart3, ShieldCheck, UsersRound, History, Briefcase, Contact, Banknote,
} from 'lucide-react'

type Role = 'all' | 'staff' | 'owner' | 'member'
interface NavItem { icon: any; label: string; short: string; to: string; roles: Role }
interface NavGroup { icon: any; label: string; roles: Role; children: NavItem[] }
type NavEntry = NavItem | NavGroup
const isGroup = (e: NavEntry): e is NavGroup => 'children' in e

function roleOk(roles: Role, role?: UserRole): boolean {
  if (roles === 'all') return true
  if (roles === 'staff') return isStaff(role)
  if (roles === 'owner') return isOwner(role)
  if (roles === 'member') return !isStaff(role)  // hanya member
  return false
}

// Nav back office: 2 menu langsung + 3 grup ber-submenu
const STAFF_NAV: NavEntry[] = [
  { icon: LayoutDashboard, label: 'Dashboard', short: 'Home', to: '/', roles: 'all' },
  { icon: CalendarDays, label: 'Jadwal', short: 'Jadwal', to: '/jadwal', roles: 'all' },
  { icon: Users, label: 'Member', roles: 'staff', children: [
    { icon: Users, label: 'Data Member', short: 'Member', to: '/member', roles: 'staff' },
    { icon: UsersRound, label: 'Laporan Member', short: 'Lap. Mbr', to: '/laporan-member', roles: 'staff' },
    { icon: Package, label: 'Paket', short: 'Paket', to: '/paket', roles: 'staff' },
  ] },
  { icon: Coins, label: 'Keuangan', roles: 'staff', children: [
    { icon: Wallet, label: 'Pembayaran', short: 'Bayar', to: '/pembayaran', roles: 'staff' },
    { icon: Coins, label: 'Kas & Pengeluaran', short: 'Uang', to: '/keuangan', roles: 'staff' },
    { icon: BarChart3, label: 'Laporan Keuangan', short: 'Laporan', to: '/laporan', roles: 'owner' },
  ] },
  { icon: Briefcase, label: 'Karyawan', roles: 'owner', children: [
    { icon: Contact, label: 'Data Karyawan', short: 'Karyawan', to: '/karyawan', roles: 'owner' },
    { icon: Banknote, label: 'Payroll', short: 'Payroll', to: '/payroll', roles: 'owner' },
  ] },
  { icon: SettingsIcon, label: 'Pengaturan', roles: 'staff', children: [
    { icon: Building2, label: 'Cabang', short: 'Cabang', to: '/cabang', roles: 'staff' },
    { icon: ShieldCheck, label: 'Pengguna Sistem', short: 'User', to: '/pengguna', roles: 'owner' },
    { icon: SettingsIcon, label: 'Pengaturan Studio', short: 'Set', to: '/pengaturan', roles: 'staff' },
  ] },
]

// Nav member (flat): dashboard, jadwal, riwayat
const MEMBER_NAV: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', short: 'Home', to: '/', roles: 'all' },
  { icon: CalendarDays, label: 'Jadwal', short: 'Jadwal', to: '/jadwal', roles: 'all' },
  { icon: History, label: 'Riwayat', short: 'Riwayat', to: '/riwayat', roles: 'member' },
]

function pathActive(to: string, pathname: string): boolean {
  return to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(to + '/')
}

function BranchSwitcher() {
  const { branches, activeBranch, setActiveId } = useBranch()
  const [open, setOpen] = useState(false)
  if (branches.length === 0) return null
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full bg-sand hover:bg-copper-100 px-3 py-1.5 text-sm font-medium transition">
        <Building2 size={15} className="text-copper-600" />
        <span className="max-w-[100px] sm:max-w-[160px] truncate">{activeBranch?.name ?? 'Cabang'}</span>
        <ChevronDown size={14} className="text-ink/40" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 mt-2 w-60 bg-white rounded-xl shadow-card border border-sand py-1.5 z-50">
            <div className="px-3 py-1.5 text-[11px] uppercase tracking-wider text-ink/40">Cabang aktif</div>
            {branches.map((b) => (
              <button key={b.id} onClick={() => { setActiveId(b.id); setOpen(false) }}
                className={`flex items-center gap-2 w-full text-left px-3 py-2 text-sm hover:bg-sand ${b.id === activeBranch?.id ? 'text-copper-700 font-semibold' : 'text-ink/70'}`}>
                <Building2 size={14} /> {b.name}{b.is_default ? ' · utama' : ''}
              </button>
            ))}
            <Link to="/cabang" onClick={() => setOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-copper-700 border-t border-sand mt-1">
              <Plus size={14} /> Kelola cabang
            </Link>
          </div>
        </>
      )}
    </div>
  )
}

export default function Layout() {
  const { user } = useAuth()
  return isStaff(user?.role) ? <StaffShell /> : <MemberShell />
}

/* Dropdown user (pojok kanan atas) — Profil, Pengaturan (staf), Keluar */
function UserMenu() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const staff = isStaff(user?.role)
  return (
    <div className="relative shrink-0">
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 rounded-full hover:bg-sand px-2 py-1.5 transition">
        <Avatar user={user} size={32} />
        <span className="text-sm font-semibold hidden sm:block max-w-[120px] truncate">{user?.full_name}</span>
        <ChevronDown size={15} className="text-ink/40 hidden sm:block" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-card border border-sand py-1.5 z-50">
            <div className="px-4 py-2 border-b border-sand">
              <div className="text-sm font-semibold truncate">{user?.full_name}</div>
              <div className="text-xs text-ink/50">{user && ROLE_LABEL[user.role as UserRole]}</div>
            </div>
            <Link to="/profil" onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-sand">
              <UserRound size={16} /> Profil
            </Link>
            {staff && (
              <Link to="/pengaturan" onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-sand">
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
  )
}

/* ─────────────── Komponen sidebar (menu + submenu) ─────────────── */
function SidebarLeaf({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  return (
    <NavLink to={item.to} end={item.to === '/'} onClick={onNavigate}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
          isActive ? 'bg-copper-100 text-copper-700' : 'text-ink/65 hover:bg-sand'}`}>
      <item.icon size={18} /> {item.label}
    </NavLink>
  )
}

function SidebarGroup({ group, role, onNavigate }: { group: NavGroup; role?: UserRole; onNavigate: () => void }) {
  const loc = useLocation()
  const children = group.children.filter((c) => roleOk(c.roles, role))
  const activeInside = children.some((c) => pathActive(c.to, loc.pathname))
  const [open, setOpen] = useState(activeInside)
  useEffect(() => { if (activeInside) setOpen(true) }, [activeInside])
  if (!children.length) return null
  return (
    <div>
      <button onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
          activeInside ? 'text-copper-700' : 'text-ink/65 hover:bg-sand'}`}>
        <group.icon size={18} />
        <span className="flex-1 text-left">{group.label}</span>
        <ChevronDown size={15} className={`text-ink/40 transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && (
        <div className="mt-1 ml-4 pl-3 border-l border-sand space-y-1">
          {children.map((c) => (
            <NavLink key={c.to} to={c.to} end={c.to === '/'} onClick={onNavigate}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition ${
                  isActive ? 'bg-copper-100 text-copper-700 font-medium' : 'text-ink/60 hover:bg-sand'}`}>
              <c.icon size={16} /> {c.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

function SidebarNav({ role, onNavigate }: { role?: UserRole; onNavigate: () => void }) {
  return (
    <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
      {STAFF_NAV.map((e) =>
        isGroup(e)
          ? <SidebarGroup key={e.label} group={e} role={role} onNavigate={onNavigate} />
          : (roleOk(e.roles, role) ? <SidebarLeaf key={e.to} item={e} onNavigate={onNavigate} /> : null)
      )}
    </nav>
  )
}

/* ─────────────── BACK OFFICE: SIDEBAR ─────────────── */
function StaffShell() {
  const [drawer, setDrawer] = useState(false)
  const loc = useLocation()
  const { user } = useAuth()

  const SidebarBody = (
    <>
      <div className="h-16 flex items-center px-5 border-b border-sand">
        <Link to="/" onClick={() => setDrawer(false)}><Brand size="sm" imgClassName="!h-9" showName /></Link>
      </div>
      <SidebarNav role={user?.role} onNavigate={() => setDrawer(false)} />
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
        {/* Topbar — hamburger (mobile) + logo (mobile) di kiri, menu user di kanan */}
        <header className="sticky top-0 z-20 h-16 flex items-center justify-between px-4 lg:px-8 bg-cream/85 backdrop-blur border-b border-sand">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={() => setDrawer(true)} className="btn-ghost !px-2 lg:hidden"><Menu size={20} /></button>
            <div className="lg:hidden shrink-0"><Brand size="sm" imgClassName="!h-9" /></div>
            <BranchSwitcher />
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <UserMenu />
          </div>
        </header>

        <main key={loc.pathname} className="max-w-5xl mx-auto px-4 lg:px-8 py-6 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

/* ─────────────── MEMBER: TOP + BOTTOM NAV (mobile-first) ─────────────── */
function MemberShell() {
  const items = MEMBER_NAV
  return (
    <div className="min-h-screen bg-cream">
      <header className="sticky top-0 z-20 bg-cream/80 backdrop-blur border-b border-sand">
        <div className="mx-auto max-w-5xl px-4 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="shrink-0"><Brand size="sm" imgClassName="!h-10" showName /></Link>

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

          <UserMenu />
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
