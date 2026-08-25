import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, tokenStore } from '@/services/api'
import type { User } from '@/types'

const IDLE_LOGOUT_MS = 12 * 60 * 60 * 1000   // auto-logout jika 12 jam tidak digunakan
const AUTO_REFRESH_MS = 15 * 60 * 1000        // segarkan semua data tiap 15 menit

interface AuthState {
  user: User | null
  loading: boolean
  login: (identifier: string, password: string) => Promise<void>
  register: (data: {
    email?: string; password: string; full_name: string; phone?: string
    member_category?: string; package_id?: string; payment_method?: string
  }) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthState>({} as AuthState)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const queryClient = useQueryClient()
  const lastActivity = useRef(Date.now())

  async function loadMe() {
    if (!tokenStore.access) { setLoading(false); return }
    try {
      const { data } = await api.get<User>('/auth/me')
      setUser(data)
    } catch {
      tokenStore.clear()
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadMe() }, [])

  async function login(identifier: string, password: string) {
    const { data } = await api.post('/auth/login', { identifier, password })
    tokenStore.set(data.access_token, data.refresh_token)
    const me = await api.get<User>('/auth/me')
    setUser(me.data)
  }

  async function register(data: {
    email?: string; password: string; full_name: string; phone?: string
    member_category?: string; package_id?: string; payment_method?: string
  }) {
    await api.post('/auth/register', data)
    await login(data.phone || data.email || '', data.password)
  }

  function logout() {
    tokenStore.clear()
    setUser(null)
    location.href = '/'
  }

  async function refreshUser() {
    try {
      const { data } = await api.get<User>('/auth/me')
      setUser(data)
    } catch { /* abaikan */ }
  }

  // Auto-refresh berkala + auto-logout saat idle (hanya ketika sudah login)
  useEffect(() => {
    if (!user) return
    const bump = () => { lastActivity.current = Date.now() }
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove']
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }))

    const refresh = setInterval(() => { queryClient.invalidateQueries() }, AUTO_REFRESH_MS)
    const idle = setInterval(() => {
      if (Date.now() - lastActivity.current > IDLE_LOGOUT_MS) logout()
    }, 60 * 1000)

    return () => {
      events.forEach((e) => window.removeEventListener(e, bump))
      clearInterval(refresh)
      clearInterval(idle)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
