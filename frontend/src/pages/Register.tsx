import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api'
import { useAuth } from '@/context/AuthContext'
import { formatRupiah } from '@/utils/format'
import { Loader2, Infinity as InfinityIcon, Check, Zap } from 'lucide-react'

interface Pkg { id: string; name: string; description?: string | null; is_unlimited: boolean; session_count?: number | null; price: number }

export default function Register() {
  const { register } = useAuth()
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '' })
  const [plan, setPlan] = useState<string>('per_datang') // 'per_datang' | packageId
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { data: packages } = useQuery({
    queryKey: ['public-packages'],
    queryFn: async () => (await api.get<Pkg[]>('/public/packages')).data,
  })

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    const isDropIn = plan === 'per_datang'
    try {
      await register({
        full_name: form.full_name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone || undefined,
        password: form.password,
        member_category: isDropIn ? 'per_datang' : 'bulanan',
        package_id: isDropIn ? undefined : plan,
        payment_method: 'transfer',
      })
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Gagal mendaftar. Coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-copper-600 text-white">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid place-items-center w-10 h-10 rounded-full bg-white/15 font-display font-semibold">R</span>
          <span className="font-display text-lg font-semibold">Reformer Your Body</span>
        </Link>
        <div>
          <h1 className="font-display text-4xl leading-tight mb-4">Mulai perjalanan<br />pilates-mu.</h1>
          <p className="text-white/70 max-w-sm">Buat akun, pilih paket atau bayar per datang, dan langsung booking kelas dari HP.</p>
        </div>
        <div className="text-white/50 text-sm">© {new Date().getFullYear()} Reformer Your Body</div>
      </div>

      <div className="flex items-center justify-center p-6 bg-cream">
        <div className="w-full max-w-md py-8">
          <h2 className="font-display text-2xl font-semibold mb-1">Daftar member</h2>
          <p className="text-ink/50 text-sm mb-6">Isi data & pilih paket keanggotaanmu.</p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="label">Nama lengkap</label>
              <input className="input" required autoFocus value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" required autoComplete="email" value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="nama@email.com" />
              </div>
              <div>
                <label className="label">No. WhatsApp</label>
                <input className="input" value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="08123…" />
              </div>
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" required minLength={6} autoComplete="new-password"
                value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="min. 6 karakter" />
            </div>

            {/* Pilih paket */}
            <div>
              <label className="label">Pilih paket</label>
              <div className="space-y-2">
                {/* Per datang */}
                <PlanCard active={plan === 'per_datang'} onClick={() => setPlan('per_datang')}
                  title="Per Datang (drop-in)" desc="Bayar setiap kali datang, tanpa paket." right={<Zap size={18} className="text-copper-600" />} />
                {(packages ?? []).map((p) => (
                  <PlanCard key={p.id} active={plan === p.id} onClick={() => setPlan(p.id)}
                    title={p.name}
                    desc={(p.is_unlimited ? 'Unlimited' : `${p.session_count} sesi`) + (p.description ? ` · ${p.description}` : '')}
                    right={<span className="font-display font-semibold text-copper-700 whitespace-nowrap">{p.is_unlimited ? <InfinityIcon size={16} className="inline" /> : formatRupiah(p.price)}</span>} />
                ))}
              </div>
              {plan !== 'per_datang' && (
                <p className="text-[11px] text-ink/45 mt-2">Setelah daftar, tagihan tercatat & dikonfirmasi studio saat pembayaran diterima.</p>
              )}
            </div>

            {error && <div className="text-sm text-clay-dark bg-clay/10 border border-clay/20 rounded-lg px-3 py-2">{error}</div>}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading && <Loader2 size={16} className="animate-spin" />} Daftar
            </button>
          </form>

          <p className="text-sm text-ink/50 mt-6 text-center">
            Sudah punya akun? <Link to="/login" className="text-copper-700 font-semibold">Masuk</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

function PlanCard({ active, onClick, title, desc, right }: {
  active: boolean; onClick: () => void; title: string; desc: string; right: React.ReactNode
}) {
  return (
    <button type="button" onClick={onClick}
      className={`w-full text-left rounded-xl border px-4 py-3 flex items-center gap-3 transition ${
        active ? 'border-copper-400 bg-copper-50 ring-2 ring-copper-100' : 'border-sand bg-white hover:border-copper-200'}`}>
      <span className={`grid place-items-center w-5 h-5 rounded-full border shrink-0 ${active ? 'bg-copper-600 border-copper-600 text-white' : 'border-sand'}`}>
        {active && <Check size={13} />}
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm">{title}</div>
        <div className="text-xs text-ink/50 truncate">{desc}</div>
      </div>
      {right}
    </button>
  )
}
