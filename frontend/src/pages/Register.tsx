import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Loader2 } from 'lucide-react'

export default function Register() {
  const { register } = useAuth()
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      await register({
        full_name: form.full_name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone || undefined,
        password: form.password,
      })
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Gagal mendaftar. Coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-sage-600 text-white">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid place-items-center w-10 h-10 rounded-full bg-white/15 font-display font-semibold">R</span>
          <span className="font-display text-lg font-semibold">Reformer Your Body</span>
        </Link>
        <div>
          <h1 className="font-display text-4xl leading-tight mb-4">Mulai perjalanan<br />pilates-mu.</h1>
          <p className="text-white/70 max-w-sm">Buat akun member untuk booking kelas, lihat sisa kuota, dan kelola paketmu.</p>
        </div>
        <div className="text-white/50 text-sm">© {new Date().getFullYear()} Reformer Your Body</div>
      </div>

      <div className="flex items-center justify-center p-6 bg-cream">
        <div className="w-full max-w-sm">
          <h2 className="font-display text-2xl font-semibold mb-1">Daftar member</h2>
          <p className="text-ink/50 text-sm mb-6">Gratis — cukup beberapa detik.</p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="label">Nama lengkap</label>
              <input className="input" required autoFocus value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" required autoComplete="email" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="nama@email.com" />
            </div>
            <div>
              <label className="label">Nomor HP (opsional)</label>
              <input className="input" value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="08…" />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" required minLength={6} autoComplete="new-password"
                value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="min. 6 karakter" />
            </div>

            {error && <div className="text-sm text-clay-dark bg-clay/10 border border-clay/20 rounded-lg px-3 py-2">{error}</div>}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading && <Loader2 size={16} className="animate-spin" />} Daftar
            </button>
          </form>

          <p className="text-sm text-ink/50 mt-6 text-center">
            Sudah punya akun? <Link to="/login" className="text-sage-700 font-semibold">Masuk</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
