import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Loader2 } from 'lucide-react'

export default function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email.trim(), password)
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Gagal masuk. Coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Panel kiri — mood studio */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-sage-600 text-white">
        <div className="flex items-center gap-2">
          <span className="grid place-items-center w-10 h-10 rounded-full bg-white/15 font-display font-semibold">R</span>
          <span className="font-display text-lg font-semibold">Reformer Your Body</span>
        </div>
        <div>
          <h1 className="font-display text-4xl leading-tight mb-4">
            Bergerak dengan<br />niat & keseimbangan.
          </h1>
          <p className="text-white/70 max-w-sm">
            Kelola jadwal kelas, paket, dan booking studio pilates Anda dalam satu tempat yang tenang.
          </p>
        </div>
        <div className="text-white/50 text-sm">© {new Date().getFullYear()} Reformer Your Body</div>
      </div>

      {/* Panel kanan — form */}
      <div className="flex items-center justify-center p-6 bg-cream">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8 justify-center">
            <span className="grid place-items-center w-10 h-10 rounded-full bg-sage-600 text-white font-display font-semibold">R</span>
            <span className="font-display text-lg font-semibold">Reformer Your Body</span>
          </div>

          <h2 className="font-display text-2xl font-semibold mb-1">Masuk</h2>
          <p className="text-ink/50 text-sm mb-6">Silakan masuk ke akun Anda.</p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                type="email" required autoFocus autoComplete="email"
                className="input" value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                type="password" required autoComplete="current-password"
                className="input" value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="text-sm text-clay-dark bg-clay/10 border border-clay/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading && <Loader2 size={16} className="animate-spin" />}
              Masuk
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
