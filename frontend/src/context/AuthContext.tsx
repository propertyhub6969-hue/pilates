import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { api, tokenStore } from '@/services/api'
import type { User } from '@/types'

interface AuthState {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (data: {
    email: string; password: string; full_name: string; phone?: string
    member_category?: string; package_id?: string; payment_method?: string
  }) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState>({} as AuthState)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

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

  async function login(email: string, password: string) {
    const { data } = await api.post('/auth/login', { email, password })
    tokenStore.set(data.access_token, data.refresh_token)
    const me = await api.get<User>('/auth/me')
    setUser(me.data)
  }

  async function register(data: {
    email: string; password: string; full_name: string; phone?: string
    member_category?: string; package_id?: string; payment_method?: string
  }) {
    await api.post('/auth/register', data)
    await login(data.email, data.password)
  }

  function logout() {
    tokenStore.clear()
    setUser(null)
    location.href = '/'
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
