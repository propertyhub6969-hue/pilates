import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { isStaff } from '@/types'
import { IS_OFFICE } from '@/utils/domain'
import Landing from '@/pages/Landing'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import Dashboard from '@/pages/Dashboard'
import Schedule from '@/pages/Schedule'
import Members from '@/pages/Members'
import MemberDetail from '@/pages/MemberDetail'
import Packages from '@/pages/Packages'
import Payments from '@/pages/Payments'
import Layout from '@/components/Layout'

function Splash() {
  return (
    <div className="min-h-screen grid place-items-center bg-cream">
      <div className="animate-pulse text-sage-600 font-display text-xl">Reformer Your Body…</div>
    </div>
  )
}

export default function App() {
  const { user, loading } = useAuth()
  if (loading) return <Splash />

  // Belum login
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        {!IS_OFFICE && <Route path="/register" element={<Register />} />}
        {/* apex: beranda = landing page; office: langsung ke login */}
        <Route path="/" element={IS_OFFICE ? <Navigate to="/login" replace /> : <Landing />} />
        <Route path="*" element={<Navigate to={IS_OFFICE ? '/login' : '/'} replace />} />
      </Routes>
    )
  }

  // Sudah login — aplikasi (dashboard sadar-peran)
  const staff = isStaff(user.role)
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="jadwal" element={<Schedule />} />
        {staff && <Route path="member" element={<Members />} />}
        {staff && <Route path="member/:id" element={<MemberDetail />} />}
        {staff && <Route path="paket" element={<Packages />} />}
        {staff && <Route path="pembayaran" element={<Payments />} />}
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
