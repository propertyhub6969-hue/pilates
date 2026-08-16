import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
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

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route
        path="/"
        element={user ? <Layout /> : <Navigate to="/login" replace />}
      >
        <Route index element={<Dashboard />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
