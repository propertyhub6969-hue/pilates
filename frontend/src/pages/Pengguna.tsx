import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/services/api'
import type { User } from '@/types'
import { ROLE_LABEL } from '@/types'
import { useAuth } from '@/context/AuthContext'
import Modal from '@/components/Modal'
import Avatar from '@/components/Avatar'
import { Plus, Loader2, KeyRound, Power, Check, ShieldCheck, Mail, Phone } from 'lucide-react'

type NewRole = 'admin' | 'instructor'

export default function Pengguna() {
  const qc = useQueryClient()
  const { user: me } = useAuth()
  const [open, setOpen] = useState(false)
  const [err, setErr] = useState('')
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '', role: 'admin' as NewRole })

  const { data: staff, isLoading } = useQuery({
    queryKey: ['staff'],
    queryFn: async () => (await api.get<User[]>('/members/staff')).data,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['staff'] })
  const create = useMutation({
    mutationFn: async () => api.post('/members', {
      full_name: form.full_name, email: form.email, phone: form.phone || null,
      password: form.password, role: form.role,
    }),
    onSuccess: () => { setOpen(false); setErr(''); invalidate() },
    onError: (e: any) => setErr(e?.response?.data?.detail ?? 'Gagal menambah pengguna'),
  })
  const toggle = useMutation({
    mutationFn: async (u: User) => api.patch(`/members/${u.id}`, { is_active: !u.is_active }),
    onSuccess: invalidate,
  })

  // reset password
  const [pwFor, setPwFor] = useState<User | null>(null)
  const [pwVal, setPwVal] = useState('')
  const [pwDone, setPwDone] = useState(false)
  const [pwErr, setPwErr] = useState('')
  const setPw = useMutation({
    mutationFn: async () => api.post(`/members/${pwFor!.id}/set-password`, { new_password: pwVal }),
    onSuccess: () => { setPwDone(true); setPwErr('') },
    onError: (e: any) => setPwErr(e?.response?.data?.detail ?? 'Gagal menyetel password'),
  })
  function openReset(u: User) { setPwFor(u); setPwVal(''); setPwDone(false); setPwErr('') }

  function openNew() { setForm({ full_name: '', email: '', phone: '', password: '', role: 'admin' }); setErr(''); setOpen(true) }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-semibold">Pengguna Sistem</h1>
          <p className="text-ink/50 text-sm">Kelola akun staf yang bisa masuk ke back office (admin & instruktur).</p>
        </div>
        <button onClick={openNew} className="btn-primary shrink-0"><Plus size={16} /> Tambah Pengguna</button>
      </div>

      {isLoading ? <div className="text-ink/40 py-10 text-center">Memuat…</div> : (
        <div className="grid sm:grid-cols-2 gap-3">
          {staff?.map((u) => {
            const isSelf = u.id === me?.id
            const isOwnerRow = u.role === 'owner'
            return (
              <div key={u.id} className={`card flex items-start gap-3 ${!u.is_active ? 'opacity-60' : ''}`}>
                <Avatar user={u} size={44} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold truncate">{u.full_name}</span>
                    <span className={`text-[11px] rounded-full px-2 py-0.5 border ${isOwnerRow ? 'bg-copper-100 text-copper-700 border-copper-200' : 'bg-sand text-ink/60 border-sand'}`}>{ROLE_LABEL[u.role]}</span>
                    {isSelf && <span className="text-[11px] text-ink/40">(Anda)</span>}
                    {!u.is_active && <span className="text-[11px] text-clay">nonaktif</span>}
                  </div>
                  <div className="text-xs text-ink/55 mt-1 flex flex-col gap-0.5">
                    <span className="inline-flex items-center gap-1 truncate"><Mail size={12} /> {u.email}</span>
                    {u.phone && <span className="inline-flex items-center gap-1"><Phone size={12} /> {u.phone}</span>}
                  </div>
                  {!isOwnerRow && (
                    <div className="flex items-center gap-1 mt-2">
                      <button onClick={() => openReset(u)} className="btn-ghost !px-2 !py-1 text-xs text-ink/60 border border-sand"><KeyRound size={13} /> Reset password</button>
                      {!isSelf && (
                        <button onClick={() => toggle.mutate(u)} disabled={toggle.isPending} className={`btn-ghost !px-2 !py-1 text-xs border border-sand ${u.is_active ? 'text-clay-dark' : 'text-copper-700'}`}>
                          <Power size={13} /> {u.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          {staff?.length === 0 && <div className="text-ink/40 col-span-full text-center py-10">Belum ada pengguna staf.</div>}
        </div>
      )}

      {/* Tambah pengguna */}
      <Modal open={open} onClose={() => setOpen(false)} title="Tambah Pengguna Sistem">
        <form onSubmit={(e) => { e.preventDefault(); setErr(''); create.mutate() }} className="space-y-4">
          <div><label className="label">Nama lengkap</label><input className="input" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div><label className="label">Email (untuk login)</label><input type="email" className="input" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><label className="label">No. WhatsApp</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="08…" /></div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div><label className="label">Password awal</label><input type="text" className="input" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="min. 6 karakter" /></div>
            <div><label className="label">Peran</label>
              <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as NewRole })}>
                <option value="admin">Admin (kelola operasional + entry keuangan)</option>
                <option value="instructor">Instruktur (jadwal & absensi kelasnya)</option>
              </select>
            </div>
          </div>
          <div className="text-[11px] text-ink/45 bg-sand/60 rounded-lg px-3 py-2 flex gap-2">
            <ShieldCheck size={14} className="text-copper-600 shrink-0 mt-0.5" />
            <span>Admin <b>tidak</b> bisa lihat Laporan & Buku Besar (khusus Owner). Peran Owner tak bisa dibuat dari sini.</span>
          </div>
          {err && <div className="text-sm text-clay-dark bg-clay/10 border border-clay/20 rounded-lg px-3 py-2">{err}</div>}
          <button className="btn-primary w-full" disabled={create.isPending || form.password.length < 6}>{create.isPending && <Loader2 size={16} className="animate-spin" />} Simpan</button>
        </form>
      </Modal>

      {/* Reset password */}
      <Modal open={!!pwFor} onClose={() => setPwFor(null)} title="Reset Password">
        {pwDone ? (
          <div className="space-y-4">
            <div className="text-sm text-copper-700 bg-copper-50 border border-copper-100 rounded-lg px-3 py-2 flex items-center gap-2"><Check size={16} /> Password berhasil disetel.</div>
            <div className="text-sm text-ink/70">Berikan password baru ini ke <b>{pwFor?.full_name}</b>:</div>
            <div className="font-mono text-lg text-center bg-sand rounded-lg py-3 select-all">{pwVal}</div>
            <button onClick={() => setPwFor(null)} className="btn-primary w-full">Selesai</button>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); setPwErr(''); setPw.mutate() }} className="space-y-4">
            <p className="text-sm text-ink/60">Tetapkan password baru untuk <b>{pwFor?.full_name}</b>.</p>
            <div className="flex gap-2">
              <input className="input flex-1" required minLength={6} value={pwVal} onChange={(e) => setPwVal(e.target.value)} placeholder="min. 6 karakter" />
              <button type="button" onClick={() => setPwVal('ryb' + Math.floor(1000 + Math.random() * 9000))} className="btn-ghost border border-sand shrink-0">Acak</button>
            </div>
            {pwErr && <div className="text-sm text-clay-dark bg-clay/10 border border-clay/20 rounded-lg px-3 py-2">{pwErr}</div>}
            <button className="btn-primary w-full" disabled={setPw.isPending || pwVal.length < 6}>{setPw.isPending && <Loader2 size={16} className="animate-spin" />} Setel Password</button>
          </form>
        )}
      </Modal>
    </div>
  )
}
