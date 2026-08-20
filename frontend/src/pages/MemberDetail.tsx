import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '@/services/api'
import type { MemberDetail as TDetail, Package, Page, PaymentMethod, MemberCategory, MemberPackage, PackageUsage } from '@/types'
import { PAY_STATUS_LABEL, METHOD_LABEL, ROLE_LABEL, CATEGORY_LABEL, BOOKING_STATUS_LABEL, packageStatusLabel, packageStatusStyle } from '@/types'
import { formatRupiah, formatDate, formatDateTime, formatTime } from '@/utils/format'
import Modal from '@/components/Modal'
import {
  ArrowLeft, Plus, Loader2, Snowflake, Infinity as InfinityIcon,
  Wallet, ShoppingBag, Phone, Mail, Pencil, Trash2, Power, KeyRound, Check, ChevronDown, UserRoundX,
} from 'lucide-react'


export default function MemberDetail() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [sale, setSale] = useState<{ package_id: string; price_paid: string; method: PaymentMethod; mark_paid: boolean }>(
    { package_id: '', price_paid: '', method: 'cash', mark_paid: true },
  )

  const { data: m, isLoading } = useQuery({
    queryKey: ['member', id],
    queryFn: async () => (await api.get<TDetail>(`/members/${id}`)).data,
  })
  const { data: packages } = useQuery({
    queryKey: ['packages', 'active'],
    queryFn: async () => (await api.get<Page<Package>>('/packages', { params: { active_only: true } })).data,
  })

  // Pratinjau harga (diskon perpanjangan) saat paket dipilih & belum override harga manual
  const { data: quote } = useQuery({
    queryKey: ['purchase-quote', id, sale.package_id],
    enabled: open && !!sale.package_id,
    queryFn: async () => (await api.get<{ base_price: number; renewal_discount: number; eligible: boolean; total: number }>(`/members/${id}/purchase-quote`, { params: { package_id: sale.package_id } })).data,
  })

  const purchase = useMutation({
    mutationFn: async () => {
      const body: any = { package_id: sale.package_id, method: sale.method, mark_paid: sale.mark_paid }
      if (sale.price_paid) body.price_paid = Number(sale.price_paid)
      return (await api.post(`/members/${id}/purchase`, body)).data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['member', id] })
      setOpen(false); setSale({ package_id: '', price_paid: '', method: 'cash', mark_paid: true })
    },
    onError: (e: any) => setError(e?.response?.data?.detail ?? 'Gagal menyimpan'),
  })

  const freeze = useMutation({
    mutationFn: async (mpId: string) => api.post(`/members/${id}/packages/${mpId}/freeze`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['member', id] }),
  })

  const [ticketOpen, setTicketOpen] = useState(false)
  const [tk, setTk] = useState<{ method: PaymentMethod; mark_paid: boolean; price: string }>({ method: 'cash', mark_paid: true, price: '' })
  const [ticketErr, setTicketErr] = useState('')
  const addTicket = useMutation({
    mutationFn: async () => {
      const body: any = { method: tk.method, mark_paid: tk.mark_paid }
      if (tk.price) body.price = Number(tk.price)
      return api.post(`/members/${id}/dropin-ticket`, body)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['member', id] }); setTicketOpen(false); setTk({ method: 'cash', mark_paid: true, price: '' }) },
    onError: (e: any) => setTicketErr(e?.response?.data?.detail ?? 'Gagal menambah tiket'),
  })

  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({ full_name: '', phone: '', member_category: '' as MemberCategory | '', date_of_birth: '', emergency_contact: '', notes: '' })
  const edit = useMutation({
    mutationFn: async () => api.patch(`/members/${id}`, {
      full_name: editForm.full_name,
      phone: editForm.phone || null,
      member_category: editForm.member_category || null,
      date_of_birth: editForm.date_of_birth || null,
      emergency_contact: editForm.emergency_contact || null,
      notes: editForm.notes || null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['member', id] }); qc.invalidateQueries({ queryKey: ['member-counts'] }); setEditOpen(false) },
    onError: (e: any) => setError(e?.response?.data?.detail ?? 'Gagal menyimpan'),
  })
  function openEdit(data: TDetail) {
    setEditForm({
      full_name: data.full_name, phone: data.phone ?? '', member_category: data.member_category ?? '',
      date_of_birth: data.date_of_birth ?? '', emergency_contact: data.emergency_contact ?? '', notes: data.notes ?? '',
    })
    setError(''); setEditOpen(true)
  }

  const remove = useMutation({
    mutationFn: async () => (await api.delete(`/members/${id}`)).data as { status: string; message: string },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['users'] }); qc.invalidateQueries({ queryKey: ['member-counts'] })
      if (res.status === 'deleted') { nav('/member') }
      else { alert(res.message); qc.invalidateQueries({ queryKey: ['member', id] }) }
    },
    onError: (e: any) => alert(e?.response?.data?.detail ?? 'Gagal menghapus'),
  })
  const reactivate = useMutation({
    mutationFn: async () => api.patch(`/members/${id}`, { is_active: true }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['member', id] }); qc.invalidateQueries({ queryKey: ['users'] }) },
  })
  const toPerDatang = useMutation({
    mutationFn: async () => api.patch(`/members/${id}`, { member_category: 'per_datang' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['member', id] }); qc.invalidateQueries({ queryKey: ['users'] })
      qc.invalidateQueries({ queryKey: ['member-counts'] })
    },
    onError: (e: any) => alert(e?.response?.data?.detail ?? 'Gagal memindahkan'),
  })

  const [pwOpen, setPwOpen] = useState(false)
  const [pwValue, setPwValue] = useState('')
  const [pwDone, setPwDone] = useState(false)
  const [pwErr, setPwErr] = useState('')
  const setPw = useMutation({
    mutationFn: async () => api.post(`/members/${id}/set-password`, { new_password: pwValue }),
    onSuccess: () => { setPwDone(true); setPwErr('') },
    onError: (e: any) => setPwErr(e?.response?.data?.detail ?? 'Gagal menyetel password'),
  })
  function openReset() { setPwValue(''); setPwDone(false); setPwErr(''); setPwOpen(true) }
  function genPw() { setPwValue('ryb' + Math.floor(1000 + Math.random() * 9000)) }

  if (isLoading || !m) return <div className="text-ink/40 py-10 text-center">Memuat…</div>

  return (
    <div className="space-y-5">
      <button onClick={() => nav(-1)} className="btn-ghost !px-2 -ml-2 text-ink/60"><ArrowLeft size={18} /> Kembali</button>

      {/* Profil + ringkasan kuota */}
      <div className="card">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl font-semibold">{m.full_name}</h1>
              <span className="text-xs bg-sand rounded-full px-2 py-0.5 text-ink/60">{ROLE_LABEL[m.role]}</span>
              {m.member_category && <span className="text-xs bg-copper-50 text-copper-700 border border-copper-100 rounded-full px-2 py-0.5">{CATEGORY_LABEL[m.member_category]}</span>}
              {!m.is_active && <span className="text-xs text-clay">non-aktif</span>}
              <button onClick={() => openEdit(m)} className="btn-ghost !px-2 !py-1 text-ink/50" title="Edit member"><Pencil size={15} /></button>
              <button onClick={openReset} className="btn-ghost !px-2 !py-1 text-ink/50" title="Reset password"><KeyRound size={15} /></button>
              {!m.is_active && (
                <button onClick={() => reactivate.mutate()} disabled={reactivate.isPending} className="btn-ghost !px-2 !py-1 text-copper-700" title="Aktifkan kembali">
                  {reactivate.isPending ? <Loader2 size={15} className="animate-spin" /> : <Power size={15} />}
                </button>
              )}
            </div>
            <div className="mt-2 text-sm text-ink/60 flex flex-wrap gap-x-4 gap-y-1">
              <span className="inline-flex items-center gap-1"><Mail size={14} />{m.email}</span>
              {m.phone
                ? <span className="inline-flex items-center gap-1"><Phone size={14} />{m.phone}</span>
                : <button onClick={() => openEdit(m)} className="inline-flex items-center gap-1 text-copper-600 font-medium"><Phone size={14} />+ No. WhatsApp</button>}
              {m.join_date && <span>Bergabung {formatDate(m.join_date)}</span>}
            </div>
          </div>
          <div className="rounded-xl2 bg-copper-50 border border-copper-100 px-5 py-3 text-center">
            <div className="text-xs text-ink/50">Sisa kuota</div>
            <div className="font-display text-2xl font-semibold text-copper-700">
              {m.has_unlimited ? <span className="inline-flex items-center gap-1"><InfinityIcon size={22} /></span> : (m.active_sessions_remaining ?? 0)}
            </div>
          </div>
        </div>
        {m.role === 'member' && (
          <div className="flex gap-2 mt-4 flex-wrap">
            <button onClick={() => { setError(''); setOpen(true) }} className="btn-primary"><Plus size={16} /> Jual Paket</button>
            {m.member_category === 'per_datang' && (
              <button onClick={() => { setTicketErr(''); setTicketOpen(true) }} className="btn-ghost border border-sand"><Plus size={16} /> Tambah Tiket Drop-in</button>
            )}
            {m.member_category !== 'per_datang' && (
              <button onClick={() => { if (confirm('Non-aktifkan keanggotaan bulanan & pindahkan member ini ke daftar Per-Datang?')) toPerDatang.mutate() }}
                disabled={toPerDatang.isPending} className="btn-ghost border border-sand text-clay-dark">
                {toPerDatang.isPending ? <Loader2 size={16} className="animate-spin" /> : <UserRoundX size={16} />} Non-aktifkan → Per-Datang
              </button>
            )}
          </div>
        )}
      </div>

      {/* Paket */}
      <div>
        <h2 className="font-display text-lg font-semibold mb-2 flex items-center gap-2"><ShoppingBag size={18} /> Paket</h2>
        <div className="space-y-2">
          {m.packages.map((p) => (
            <PackageCard key={p.id} p={p} onFreeze={() => freeze.mutate(p.id)} />
          ))}
          {m.packages.length === 0 && <div className="text-ink/40 text-sm py-4 text-center">Belum ada paket.</div>}
        </div>
      </div>

      {/* Pembayaran */}
      <div>
        <h2 className="font-display text-lg font-semibold mb-2 flex items-center gap-2"><Wallet size={18} /> Riwayat Pembayaran</h2>
        <div className="space-y-2">
          {m.payments.map((p) => (
            <div key={p.id} className="card flex items-center justify-between">
              <div>
                <div className="font-semibold">{formatRupiah(p.amount)}</div>
                <div className="text-xs text-ink/50">{formatDateTime(p.created_at)} · {METHOD_LABEL[p.method]}</div>
              </div>
              <span className={`text-[11px] rounded-full px-2 py-0.5 ${p.status === 'paid' ? 'bg-copper-100 text-copper-700' : p.status === 'pending' ? 'bg-clay/10 text-clay-dark' : 'bg-sand text-ink/50'}`}>
                {PAY_STATUS_LABEL[p.status]}
              </span>
            </div>
          ))}
          {m.payments.length === 0 && <div className="text-ink/40 text-sm py-4 text-center">Belum ada pembayaran.</div>}
        </div>
      </div>

      {/* Hapus member */}
      <div className="pt-2">
        <button
          onClick={() => { if (confirm(`Hapus ${m.full_name}? Jika sudah ada riwayat pembayaran, member akan dinonaktifkan (data keuangan tetap tersimpan).`)) remove.mutate() }}
          disabled={remove.isPending}
          className="btn-ghost text-clay-dark border border-clay/20 hover:bg-clay/5">
          {remove.isPending ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} Hapus member
        </button>
      </div>

      {/* Modal reset password (admin) */}
      <Modal open={pwOpen} onClose={() => setPwOpen(false)} title="Reset Password Member">
        {pwDone ? (
          <div className="space-y-4">
            <div className="text-sm text-copper-700 bg-copper-50 border border-copper-100 rounded-lg px-3 py-2 flex items-center gap-2">
              <Check size={16} /> Password berhasil disetel.
            </div>
            <div className="text-sm text-ink/70">Sampaikan password baru ini ke <b>{m.full_name}</b>:</div>
            <div className="font-mono text-lg text-center bg-sand rounded-lg py-3 select-all">{pwValue}</div>
            <p className="text-xs text-ink/45">Minta member segera menggantinya sendiri di menu Profil setelah masuk.</p>
            <button onClick={() => setPwOpen(false)} className="btn-primary w-full">Selesai</button>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); setPwErr(''); setPw.mutate() }} className="space-y-4">
            <p className="text-sm text-ink/60">Tetapkan password sementara untuk member ini. Berguna bila member lupa password dan tak bisa menerima OTP (mis. ganti nomor).</p>
            <div>
              <label className="label">Password baru</label>
              <div className="flex gap-2">
                <input className="input flex-1" required minLength={6} value={pwValue}
                  onChange={(e) => setPwValue(e.target.value)} placeholder="Minimal 6 karakter" />
                <button type="button" onClick={genPw} className="btn-ghost border border-sand shrink-0">Acak</button>
              </div>
            </div>
            {pwErr && <div className="text-sm text-clay-dark bg-clay/10 border border-clay/20 rounded-lg px-3 py-2">{pwErr}</div>}
            <button className="btn-primary w-full" disabled={setPw.isPending || pwValue.length < 6}>
              {setPw.isPending && <Loader2 size={16} className="animate-spin" />} Setel Password
            </button>
          </form>
        )}
      </Modal>

      {/* Modal edit member */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Member">
        <form onSubmit={(e) => { e.preventDefault(); setError(''); edit.mutate() }} className="space-y-4">
          <div>
            <label className="label">Nama lengkap</label>
            <input className="input" required value={editForm.full_name}
              onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} />
          </div>
          <div>
            <label className="label">No. WhatsApp <span className="text-copper-600">· untuk pengingat kelas</span></label>
            <input className="input" value={editForm.phone}
              onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} placeholder="08123456789" />
            <p className="text-[11px] text-ink/40 mt-1">Reminder H-1 kelas dikirim ke nomor ini via WhatsApp.</p>
          </div>
          {m.role === 'member' && (
            <div>
              <label className="label">Kategori member</label>
              <select className="input" value={editForm.member_category}
                onChange={(e) => setEditForm({ ...editForm, member_category: e.target.value as MemberCategory | '' })}>
                <option value="">— belum diatur —</option>
                <option value="bulanan">Bulanan</option>
                <option value="private">Private Training</option>
                <option value="per_datang">Per Datang</option>
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Tgl lahir</label>
              <input className="input" type="date" value={editForm.date_of_birth}
                onChange={(e) => setEditForm({ ...editForm, date_of_birth: e.target.value })} />
            </div>
            <div>
              <label className="label">Kontak darurat</label>
              <input className="input" value={editForm.emergency_contact}
                onChange={(e) => setEditForm({ ...editForm, emergency_contact: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Catatan (medis/preferensi)</label>
            <textarea className="input" rows={2} value={editForm.notes}
              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
          </div>
          {error && <div className="text-sm text-clay-dark bg-clay/10 border border-clay/20 rounded-lg px-3 py-2">{error}</div>}
          <button type="submit" disabled={edit.isPending} className="btn-primary w-full">
            {edit.isPending && <Loader2 size={16} className="animate-spin" />} Simpan
          </button>
        </form>
      </Modal>

      {/* Modal tambah tiket drop-in */}
      <Modal open={ticketOpen} onClose={() => setTicketOpen(false)} title="Tambah Tiket Drop-in">
        <form onSubmit={(e) => { e.preventDefault(); setTicketErr(''); addTicket.mutate() }} className="space-y-4">
          <p className="text-sm text-ink/60">Tiket = 1 sesi. Member pakai saat booking; berkurang otomatis.</p>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Metode bayar</label>
              <select className="input" value={tk.method} onChange={(e) => setTk({ ...tk, method: e.target.value as PaymentMethod })}>
                <option value="cash">Tunai</option>
                <option value="transfer">Transfer</option>
                <option value="qris">QRIS</option>
              </select>
            </div>
            <div><label className="label">Harga (Rp)</label>
              <input className="input" type="number" min={0} value={tk.price} onChange={(e) => setTk({ ...tk, price: e.target.value })} placeholder="default studio" /></div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={tk.mark_paid} onChange={(e) => setTk({ ...tk, mark_paid: e.target.checked })} />
            Sudah lunas (tiket langsung aktif)
          </label>
          {!tk.mark_paid && <p className="text-[11px] text-ink/40">Belum lunas → tiket menunggu; aktif setelah pembayaran diverifikasi di menu Pembayaran.</p>}
          {ticketErr && <div className="text-sm text-clay-dark bg-clay/10 border border-clay/20 rounded-lg px-3 py-2">{ticketErr}</div>}
          <button className="btn-primary w-full" disabled={addTicket.isPending}>{addTicket.isPending && <Loader2 size={16} className="animate-spin" />} Simpan Tiket</button>
        </form>
      </Modal>

      {/* Modal jual paket */}
      <Modal open={open} onClose={() => setOpen(false)} title="Jual Paket">
        <form onSubmit={(e) => { e.preventDefault(); setError(''); purchase.mutate() }} className="space-y-4">
          <div>
            <label className="label">Paket</label>
            <select className="input" required value={sale.package_id}
              onChange={(e) => setSale({ ...sale, package_id: e.target.value })}>
              <option value="" disabled>Pilih paket…</option>
              {packages?.items.map((p) => (
                <option key={p.id} value={p.id}>{p.name} — {formatRupiah(p.price)}</option>
              ))}
            </select>
          </div>

          {quote?.eligible && !sale.price_paid && (
            <div className="rounded-xl border border-copper-200 bg-copper-50 p-3 text-sm space-y-1">
              <div className="flex justify-between text-ink/60"><span>Harga normal</span><span>{formatRupiah(quote.base_price)}</span></div>
              <div className="flex justify-between text-copper-700 font-medium"><span>Diskon perpanjangan</span><span>−{formatRupiah(quote.renewal_discount)}</span></div>
              <div className="flex justify-between font-semibold border-t border-copper-200 pt-1"><span>Total</span><span>{formatRupiah(quote.total)}</span></div>
              <p className="text-[11px] text-copper-700/70">Member masih pegang paket ini & belum expired → perpanjang tepat waktu.</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Harga bayar</label>
              <input className="input" type="number" min={0} value={sale.price_paid}
                onChange={(e) => setSale({ ...sale, price_paid: e.target.value })}
                placeholder={quote ? `otomatis ${formatRupiah(quote.total)}` : 'default harga paket'} />
              {quote?.eligible && !sale.price_paid && <p className="text-[11px] text-ink/40 mt-1">Kosongkan = pakai harga diskon otomatis.</p>}
            </div>
            <div>
              <label className="label">Metode</label>
              <select className="input" value={sale.method}
                onChange={(e) => setSale({ ...sale, method: e.target.value as PaymentMethod })}>
                {(['cash', 'transfer', 'qris', 'card', 'other'] as PaymentMethod[]).map((mth) => (
                  <option key={mth} value={mth}>{METHOD_LABEL[mth]}</option>
                ))}
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={sale.mark_paid}
              onChange={(e) => setSale({ ...sale, mark_paid: e.target.checked })} />
            Sudah lunas (jika tidak, dicatat sebagai menunggu)
          </label>
          {error && <div className="text-sm text-clay-dark bg-clay/10 border border-clay/20 rounded-lg px-3 py-2">{error}</div>}
          <button type="submit" disabled={purchase.isPending} className="btn-primary w-full">
            {purchase.isPending && <Loader2 size={16} className="animate-spin" />} Simpan
          </button>
        </form>
      </Modal>
    </div>
  )
}

/* ─────────── Kartu paket (accordion penggunaan sesi) ─────────── */
function PackageCard({ p, onFreeze }: { p: MemberPackage; onFreeze: () => void }) {
  const [open, setOpen] = useState(false)
  const [limit, setLimit] = useState(5)
  const used = p.is_unlimited ? null : (p.sessions_total ?? 0) - (p.sessions_remaining ?? 0)
  const { data: usage, isLoading } = useQuery({
    queryKey: ['pkg-usage', p.id],
    enabled: open,
    queryFn: async () => (await api.get<PackageUsage[]>(`/members/packages/${p.id}/usage`)).data,
  })
  return (
    <div className="card !p-0 overflow-hidden">
      <div className="flex items-center gap-3 p-3">
        <button onClick={() => setOpen((v) => !v)} className="flex-1 flex items-center gap-2 text-left min-w-0">
          <ChevronDown size={16} className={`text-ink/40 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
          <div className="min-w-0">
            <div className="font-semibold truncate">{p.package_name}</div>
            <div className="text-xs text-ink/50">
              Beli {formatDate(p.purchased_at)}{p.expires_at ? ` · s/d ${formatDate(p.expires_at)}` : ''} · {formatRupiah(p.price_paid)}
            </div>
          </div>
        </button>
        <div className="text-right shrink-0">
          <div className="text-sm font-semibold">
            {p.is_unlimited ? <InfinityIcon size={16} className="inline" /> : `${p.sessions_remaining}/${p.sessions_total}`}
          </div>
          <span className={`text-[11px] rounded-full px-2 py-0.5 ${packageStatusStyle(p)}`}>{packageStatusLabel(p)}</span>
        </div>
        {(p.status === 'active' || p.status === 'frozen') && (
          <button onClick={onFreeze} className="btn-ghost !px-2 !py-1.5 shrink-0"
            title={p.status === 'frozen' ? 'Aktifkan' : 'Bekukan'}>
            <Snowflake size={15} className={p.status === 'frozen' ? 'text-clay' : 'text-ink/40'} />
          </button>
        )}
      </div>

      {open && (
        <div className="border-t border-sand bg-sand/30 px-4 py-3">
          <div className="text-xs text-ink/50 mb-2">
            {used !== null ? <>Terpakai <b>{used}</b> sesi{p.is_unlimited ? '' : ` dari ${p.sessions_total}`}</> : 'Paket unlimited'}
          </div>
          {isLoading ? <div className="text-ink/40 text-sm py-2 text-center">Memuat…</div>
            : (usage?.length ?? 0) === 0 ? <div className="text-ink/40 text-sm py-2 text-center">Belum ada sesi terpakai dari paket ini.</div>
            : (
              <>
                <ol className="space-y-1.5">
                  {usage!.slice(0, limit).map((u, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <span className="font-display font-semibold text-copper-700 w-12 shrink-0">{formatTime(u.start_time)}</span>
                      <span className="flex-1 min-w-0"><span className="truncate">{u.title}</span> <span className="text-ink/45 text-xs">· {formatDate(u.session_date)}</span></span>
                      <span className={`text-[10px] rounded-full px-2 py-0.5 shrink-0 ${u.status === 'attended' ? 'bg-copper-100 text-copper-700' : u.status === 'no_show' ? 'bg-clay/10 text-clay-dark' : 'bg-sand text-ink/50'}`}>{BOOKING_STATUS_LABEL[u.status]}</span>
                    </li>
                  ))}
                </ol>
                {usage!.length > limit && (
                  <button onClick={() => setLimit((n) => n + 5)} className="w-full text-center text-xs text-copper-700 font-medium py-2 hover:underline">
                    Muat lebih ({usage!.length - limit} lagi)
                  </button>
                )}
              </>
            )}
        </div>
      )}
    </div>
  )
}
