import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '@/services/api'
import Brand from '@/components/Brand'
import { Loader2, ArrowLeft, ShieldCheck, MessageCircle } from 'lucide-react'

export default function ForgotPassword() {
  const nav = useNavigate()
  const [step, setStep] = useState<1 | 2>(1)
  const [identifier, setIdentifier] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  async function requestCode(e: React.FormEvent) {
    e.preventDefault(); setError(''); setInfo(''); setLoading(true)
    try {
      const { data } = await api.post('/auth/forgot-password', { identifier: identifier.trim() })
      setInfo(data?.message ?? 'Kode telah dikirim via WhatsApp bila data cocok.')
      setStep(2)
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Gagal mengirim kode. Coba lagi.')
    } finally { setLoading(false) }
  }

  async function doReset(e: React.FormEvent) {
    e.preventDefault(); setError('')
    if (newPassword !== confirm) { setError('Konfirmasi password tidak cocok.'); return }
    setLoading(true)
    try {
      await api.post('/auth/reset-password', { identifier: identifier.trim(), code: code.trim(), new_password: newPassword })
      nav('/login', { replace: true, state: { reset: true } })
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Gagal mengganti password.')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen grid place-items-center p-6 bg-cream">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8"><Brand size="lg" imgClassName="!h-20" /></div>

        <div className="card">
          <Link to="/login" className="inline-flex items-center gap-1 text-sm text-ink/50 hover:text-copper-700 mb-4">
            <ArrowLeft size={15} /> Kembali ke masuk
          </Link>

          {step === 1 ? (
            <>
              <h2 className="font-display text-xl font-semibold mb-1">Lupa Password</h2>
              <p className="text-ink/50 text-sm mb-5">Masukkan nomor WhatsApp atau email terdaftar. Kami kirim kode verifikasi lewat WhatsApp.</p>
              <form onSubmit={requestCode} className="space-y-4">
                <div>
                  <label className="label">Nomor WhatsApp / Email</label>
                  <input className="input" required autoFocus value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)} placeholder="08123456789 atau nama@email.com" />
                </div>
                {error && <div className="text-sm text-clay-dark bg-clay/10 border border-clay/20 rounded-lg px-3 py-2">{error}</div>}
                <button className="btn-primary w-full" disabled={loading}>
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={16} />} Kirim kode
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 className="font-display text-xl font-semibold mb-1">Masukkan Kode</h2>
              <p className="text-ink/50 text-sm mb-4">Kode 6 digit dikirim ke WhatsApp Anda (berlaku 10 menit).</p>
              {info && <div className="text-sm text-copper-700 bg-copper-50 border border-copper-100 rounded-lg px-3 py-2 mb-4 flex items-center gap-2"><ShieldCheck size={15} /> {info}</div>}
              <form onSubmit={doReset} className="space-y-4">
                <div>
                  <label className="label">Kode verifikasi</label>
                  <input className="input tracking-[0.4em] text-center text-lg" required autoFocus inputMode="numeric"
                    maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="••••••" />
                </div>
                <div>
                  <label className="label">Password baru</label>
                  <input className="input" type="password" required minLength={6} value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)} placeholder="Minimal 6 karakter" />
                </div>
                <div>
                  <label className="label">Konfirmasi password baru</label>
                  <input className="input" type="password" required value={confirm}
                    onChange={(e) => setConfirm(e.target.value)} />
                </div>
                {error && <div className="text-sm text-clay-dark bg-clay/10 border border-clay/20 rounded-lg px-3 py-2">{error}</div>}
                <button className="btn-primary w-full" disabled={loading}>
                  {loading && <Loader2 size={16} className="animate-spin" />} Ganti password
                </button>
                <button type="button" onClick={() => { setStep(1); setError(''); setInfo('') }}
                  className="text-sm text-ink/50 hover:text-copper-700 w-full text-center">
                  Tidak menerima kode? Kirim ulang
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
