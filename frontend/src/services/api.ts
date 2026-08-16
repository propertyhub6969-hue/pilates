import axios from 'axios'

const ACCESS_KEY = 'ryb_access'
const REFRESH_KEY = 'ryb_refresh'

export const tokenStore = {
  get access() { return localStorage.getItem(ACCESS_KEY) },
  get refresh() { return localStorage.getItem(REFRESH_KEY) },
  set(access: string, refresh: string) {
    localStorage.setItem(ACCESS_KEY, access)
    localStorage.setItem(REFRESH_KEY, refresh)
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
}

export const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const t = tokenStore.access
  if (t) config.headers.Authorization = `Bearer ${t}`
  return config
})

// Refresh otomatis saat access token kedaluwarsa (401), lalu ulangi request sekali.
let refreshing: Promise<string | null> | null = null

async function doRefresh(): Promise<string | null> {
  const rt = tokenStore.refresh
  if (!rt) return null
  try {
    const { data } = await axios.post('/api/v1/auth/refresh', { refresh_token: rt })
    tokenStore.set(data.access_token, data.refresh_token)
    return data.access_token as string
  } catch {
    tokenStore.clear()
    return null
  }
}

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      refreshing = refreshing ?? doRefresh()
      const newToken = await refreshing
      refreshing = null
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`
        return api(original)
      }
      if (location.pathname !== '/login') location.href = '/login'
    }
    return Promise.reject(error)
  },
)
