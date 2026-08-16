import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { isStaff } from '@/types'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
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

  const staff = isStaff(user?.role)

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={user ? <Layout /> : <Navigate to="/login" replace />}>
        <Route index element={<Dashboard />} />
        {staff && <Route path="member" element={<Members />} />}
        {staff && <Route path="member/:id" element={<MemberDetail />} />}
        {staff && <Route path="paket" element={<Packages />} />}
        {staff && <Route path="pembayaran" element={<Payments />} />}
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
