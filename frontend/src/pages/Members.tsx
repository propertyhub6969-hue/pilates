import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '@/services/api'
import { waLink, formatDate } from '@/utils/format'
import type { Page, User, MemberCategory } from '@/types'
import { CATEGORY_SHORT, SESSION_STATUS_LABEL, sessionStatusStyle } from '@/types'
import Modal from '@/components/Modal'
import { Plus, Search, ChevronRight, Loader2, UserRound, ChevronLeft, MessageCircle, Infinity as InfinityIcon, Upload, Download, FileSpreadsheet, AlertTriangle, CheckCircle2 } from 'lucide-react'

type Tab = 'all' | 'bulanan' | 'private' | 'per_datang' | 'instructor'
const PAGE_SIZE = 15
const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'Semua' },
  { key: 'bulanan', label: 'Bulanan' },
  { key: 'private', label: 'Private' },
  { key: 'per_datang', label: 'Per Datang' },
  { key: 'instructor', label: 'Instruktur' },
]

export default function Members() {
  const qc = useQueryClient()
  const nav = useNavigate()
  const [tab, setTab] = useState<Tab>('all')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '', category: 'bulanan' as MemberCategory })

  const isMemberTab = tab !== 'instructor'
  const role = tab === 'instructor' ? 'instructor' : 'member'
  const category = tab === 'all' || tab === 'instructor' ? undefined : tab

  useEffect(() => { setPage(1) }, [tab, q])

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['users', role, category, q, page],
    queryFn: async () =>
      (await api.get<Page<User>>('/members', {
        params: { role, category, q: q || undefined, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE },
      })).data,
    placeholderData: keepPreviousData,
  })

  const { data: counts } = useQuery({
    queryKey: ['member-counts'],
    queryFn: async () => (await api.get<Record<Tab, number>>('/members/counts')).data,
  })

  const create = useMutation({
    mutationFn: async () =>
      (await api.post('/members', {
        full_name: form.full_name, email: form.email.trim().toLowerCase(), phone: form.phone, password: form.password,
        role, ...(isMemberTab ? { member_category: form.category } : {}),
      })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      qc.invalidateQueries({ queryKey: ['member-counts'] })
      setOpen(false); setForm({ full_name: '', email: '', phone: '', password: '', category: 'bulanan' })
    },
    onError: (e: any) => setError(e?.response?.data?.detail ?? 'Gagal menyimpan'),
  })

  function openAdd() {
    setError('')
    setForm({ full_name: '', email: '', phone: '', password: '', category: (category ?? 'bulanan') as MemberCategory })
    setOpen(true)
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const fromN = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const toN = Math.min(page * PAGE_SIZE, total)
  const cols = isMemberTab ? 8 : 5

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-2xl font-semibold">Orang</h1>
        <div className="flex gap-2">
          {isMemberTab && (
            <button onClick={() => setImportOpen(true)} className="btn-ghost border border-sand">
              <Upload size={16} /> Import Excel
            </button>
          )}
          <button onClick={openAdd} className="btn-primary">
            <Plus size={16} /> Tambah {isMemberTab ? 'Member' : 'Instruktur'}
          </button>
        </div>
      </div>
      <ImportMembersModal open={importOpen} onClose={() => setImportOpen(false)} onDone={() => {
        qc.invalidateQueries({ queryKey: ['users'] }); qc.invalidateQueries({ queryKey: ['member-counts'] })
      }} />

      {/* Tab kategori + pencarian (sticky) */}
      <div className="sticky top-16 z-10 bg-cream border-b border-sand py-3 -mx-4 px-4 lg:-mx-8 lg:px-8 space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-0.5">
          {TABS.map((t) => {
            const n = counts?.[t.key]
            const active = tab === t.key
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`shrink-0 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition ${
                  active ? 'bg-copper-600 text-white' : 'bg-sand text-ink/60 hover:bg-copper-100'}`}>
                {t.label}
                {n !== undefined && (
                  <span className={`text-[11px] font-semibold rounded-full px-1.5 min-w-[18px] text-center ${
                    active ? 'bg-white/25 text-white' : 'bg-white/70 text-ink/50'}`}>{n}</span>
                )}
              </button>
            )
          })}
        </div>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/30" />
          <input className="input pl-9" placeholder="Cari nama, email, atau telepon…"
            value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <div className="card !p-0 overflow-hidden mt-3">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink/45 text-xs uppercase tracking-wide border-b border-sand">
                <th className="font-semibold px-4 py-3">Nama</th>
                <th className="font-semibold px-4 py-3 hidden sm:table-cell">Email</th>
                <th className="font-semibold px-4 py-3 hidden md:table-cell">No. WhatsApp</th>
                {isMemberTab && <th className="font-semibold px-4 py-3">Kategori</th>}
                {isMemberTab && <th className="font-semibold px-4 py-3">Sisa Sesi</th>}
                {isMemberTab && <th className="font-semibold px-4 py-3 hidden sm:table-cell">Status Sesi</th>}
                <th className="font-semibold px-4 py-3">Akun</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={cols} className="px-4 py-10 text-center text-ink/40">Memuat…</td></tr>
              ) : (data?.items.length ?? 0) === 0 ? (
                <tr><td colSpan={cols} className="px-4 py-10 text-center text-ink/40">
                  {q ? 'Tidak ada hasil.' : 'Belum ada data di kategori ini.'}
                </td></tr>
              ) : (
                data!.items.map((u) => (
                  <tr key={u.id} onClick={() => nav(`/member/${u.id}`)}
                    className="border-b border-sand/60 last:border-0 hover:bg-sand/40 cursor-pointer transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="grid place-items-center w-9 h-9 rounded-full bg-copper-100 text-copper-700 shrink-0"><UserRound size={16} /></span>
                        <div className="min-w-0">
                          <div className="font-semibold text-ink truncate">{u.full_name}</div>
                          <div className="text-xs text-ink/45 truncate sm:hidden">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink/60 hidden sm:table-cell">{u.email}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {u.phone
                        ? <a href={waLink(u.phone)!} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                            className="text-copper-700 hover:underline inline-flex items-center gap-1.5"><MessageCircle size={14} />{u.phone}</a>
                        : <span className="text-ink/30">—</span>}
                    </td>
                    {isMemberTab && (
                      <td className="px-4 py-3">
                        {u.member_category
                          ? <span className="text-xs rounded-full px-2 py-0.5 bg-copper-50 text-copper-700 border border-copper-100">{CATEGORY_SHORT[u.member_category]}</span>
                          : <span className="text-ink/30 text-xs">—</span>}
                      </td>
                    )}
                    {isMemberTab && (
                      <td className="px-4 py-3">
                        {u.has_unlimited
                          ? <span className="inline-flex items-center gap-1 text-copper-700 font-semibold"><InfinityIcon size={15} /></span>
                          : <span className="font-semibold">{u.active_sessions_remaining ?? 0}</span>}
                        {u.package_expires_at && <div className="text-[11px] text-ink/40 whitespace-nowrap">s/d {formatDate(u.package_expires_at)}</div>}
                      </td>
                    )}
                    {isMemberTab && (
                      <td className="px-4 py-3 hidden sm:table-cell">
                        {u.session_status
                          ? <span className={`text-xs rounded-full px-2 py-0.5 whitespace-nowrap ${sessionStatusStyle(u.session_status)}`}>{SESSION_STATUS_LABEL[u.session_status] ?? u.session_status}</span>
                          : <span className="text-ink/30 text-xs">—</span>}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      {u.is_active
                        ? <span className="text-xs rounded-full px-2 py-0.5 bg-copper-100 text-copper-700">Aktif</span>
                        : <span className="text-xs rounded-full px-2 py-0.5 bg-sand text-ink/50">Non-aktif</span>}
                    </td>
                    <td className="px-2"><ChevronRight size={16} className="text-ink/30" /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-sand text-sm">
          <div className="text-ink/50 flex items-center gap-2">
            {total > 0 ? <>Menampilkan {fromN}–{toN} dari {total}</> : 'Tidak ada data'}
            {isFetching && <Loader2 size={13} className="animate-spin text-ink/30" />}
          </div>
          <div className="flex items-center gap-1">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn-ghost !px-2 !py-1.5 disabled:opacity-30"><ChevronLeft size={16} /></button>
            <span className="text-ink/60 px-2">{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="btn-ghost !px-2 !py-1.5 disabled:opacity-30"><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={`Tambah ${isMemberTab ? 'Member' : 'Instruktur'}`}>
        <form onSubmit={(e) => { e.preventDefault(); setError(''); create.mutate() }} className="space-y-4">
          <div>
            <label className="label">Nama lengkap</label>
            <input className="input" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          {isMemberTab && (
            <div>
              <label className="label">Kategori member</label>
              <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as MemberCategory })}>
                <option value="bulanan">Bulanan</option>
                <option value="private">Private Training</option>
                <option value="per_datang">Per Datang</option>
              </select>
            </div>
          )}
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="label">No. WhatsApp {isMemberTab && <span className="text-copper-600">· untuk pengingat kelas</span>}</label>
            <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="08123456789" />
            {isMemberTab && <p className="text-[11px] text-ink/40 mt-1">Reminder H-1 kelas dikirim ke nomor ini via WhatsApp.</p>}
          </div>
          <div>
            <label className="label">Password awal</label>
            <input className="input" type="text" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="min. 6 karakter" />
          </div>
          {error && <div className="text-sm text-clay-dark bg-clay/10 border border-clay/20 rounded-lg px-3 py-2">{error}</div>}
          <button type="submit" disabled={create.isPending} className="btn-primary w-full">
            {create.isPending && <Loader2 size={16} className="animate-spin" />} Simpan
          </button>
        </form>
      </Modal>
    </div>
  )
}


// ── Modal Import Member dari Excel ──
type ImportRow = {
  row_no: number; nama: string; no_wa: string; kategori: string | null
  nama_paket: string; sisa_sesi: number | null; unlimited: boolean
  expired: string | null; gabung: string | null
  has_package: boolean; action: 'create' | 'update'; errors: string[]; warnings: string[]
}
type ImportPreview = {
  total_rows: number; to_create: number; to_update: number; with_package: number; errors: number
  rows: ImportRow[]
}

function ImportMembersModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [result, setResult] = useState<{ created: number; updated: number; packages: number; skipped: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [pwd, setPwd] = useState('reformer123')

  function reset() { setFile(null); setPreview(null); setResult(null); setErr(''); setPwd('reformer123') }
  function close() { reset(); onClose() }

  async function downloadTemplate() {
    try {
      const res = await api.get('/members/import/template', { responseType: 'blob' })
      const url = URL.createObjectURL(res.data as Blob)
      const a = document.createElement('a'); a.href = url; a.download = 'template_import_member.xlsx'
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
    } catch { alert('Gagal mengunduh template.') }
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = ''
    if (!f) return
    setFile(f); setResult(null); setErr(''); setBusy(true)
    try {
      const fd = new FormData(); fd.append('file', f)
      const res = await api.post<ImportPreview>('/members/import/preview', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setPreview(res.data)
    } catch (e: any) { setErr(e?.response?.data?.detail ?? 'Gagal membaca file'); setPreview(null) }
    finally { setBusy(false) }
  }

  async function doImport() {
    if (!file) return
    setBusy(true); setErr('')
    try {
      const fd = new FormData(); fd.append('file', file); fd.append('default_password', pwd)
      const res = await api.post('/members/import/commit', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setResult(res.data); onDone()
    } catch (e: any) { setErr(e?.response?.data?.detail ?? 'Gagal impor') }
    finally { setBusy(false) }
  }

  const okCount = preview ? preview.total_rows - preview.errors : 0

  return (
    <Modal open={open} onClose={close} title="Import Member dari Excel">
      {result ? (
        <div className="space-y-4 text-center py-2">
          <CheckCircle2 size={44} className="mx-auto text-emerald-600" />
          <div className="font-display text-lg font-semibold">Impor selesai</div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="card"><div className="text-2xl font-semibold text-copper-700">{result.created}</div><div className="text-ink/50">akun dibuat</div></div>
            <div className="card"><div className="text-2xl font-semibold text-copper-700">{result.updated}</div><div className="text-ink/50">akun diperbarui</div></div>
            <div className="card"><div className="text-2xl font-semibold text-copper-700">{result.packages}</div><div className="text-ink/50">paket berjalan</div></div>
            <div className="card"><div className="text-2xl font-semibold text-clay-dark">{result.skipped}</div><div className="text-ink/50">baris dilewati (error)</div></div>
          </div>
          <p className="text-xs text-ink/45">Member login pakai No. WA. Password awal: <b>{pwd}</b> (bisa direset via WA). Paket lama migrasi akan digantikan bila diimpor ulang.</p>
          <button onClick={close} className="btn-primary w-full">Selesai</button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-3 bg-copper-50 border border-copper-100 rounded-xl p-3 text-sm">
            <FileSpreadsheet size={20} className="text-copper-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-ink/70">Unduh template, salin datamu ke kolomnya (Nama, No. WA, Kategori, Sisa Sesi, Tanggal Expired…), lalu unggah. Tidak ada data masuk sebelum kamu klik <b>Impor</b>.</p>
              <button onClick={downloadTemplate} className="btn-ghost border border-copper-200 text-copper-700 mt-2 !py-1.5"><Download size={15} /> Unduh Template</button>
            </div>
          </div>

          <label className="block">
            <span className="label">File Excel (.xlsx)</span>
            <input type="file" accept=".xlsx" onChange={onPick}
              className="block w-full text-sm text-ink/60 file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-copper-600 file:text-white file:font-medium hover:file:bg-copper-700 file:cursor-pointer" />
            {file && <span className="text-xs text-ink/45 mt-1 inline-block">{file.name}</span>}
          </label>

          {busy && !preview && <div className="text-center py-6 text-ink/50"><Loader2 className="animate-spin inline mr-2" size={18} />Memproses…</div>}
          {err && <div className="text-sm text-clay-dark bg-clay/10 border border-clay/20 rounded-lg px-3 py-2">{err}</div>}

          {preview && (
            <>
              <div className="grid grid-cols-4 gap-2 text-center text-sm">
                <div className="rounded-lg bg-sand/60 py-2"><div className="font-semibold text-lg">{preview.total_rows}</div><div className="text-ink/50 text-xs">total baris</div></div>
                <div className="rounded-lg bg-emerald-50 py-2"><div className="font-semibold text-lg text-emerald-700">{preview.to_create}</div><div className="text-ink/50 text-xs">baru</div></div>
                <div className="rounded-lg bg-copper-50 py-2"><div className="font-semibold text-lg text-copper-700">{preview.to_update}</div><div className="text-ink/50 text-xs">diperbarui</div></div>
                <div className={`rounded-lg py-2 ${preview.errors ? 'bg-clay/10' : 'bg-sand/60'}`}><div className={`font-semibold text-lg ${preview.errors ? 'text-clay-dark' : 'text-ink/40'}`}>{preview.errors}</div><div className="text-ink/50 text-xs">error</div></div>
              </div>
              {preview.errors > 0 && (
                <div className="flex items-start gap-2 text-xs text-clay-dark bg-clay/10 border border-clay/20 rounded-lg px-3 py-2">
                  <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                  <span>{preview.errors} baris ber-error akan <b>dilewati</b>. Perbaiki di Excel lalu unggah ulang bila ingin ikut terimpor.</span>
                </div>
              )}
              <div className="max-h-64 overflow-auto border border-sand rounded-lg">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-cream">
                    <tr className="text-left text-ink/45 border-b border-sand">
                      <th className="px-2 py-1.5">#</th><th className="px-2 py-1.5">Nama</th><th className="px-2 py-1.5">No. WA</th>
                      <th className="px-2 py-1.5">Kat.</th><th className="px-2 py-1.5">Sisa</th><th className="px-2 py-1.5">Expired</th><th className="px-2 py-1.5">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((r) => (
                      <tr key={r.row_no} className={`border-b border-sand/50 ${r.errors.length ? 'bg-clay/5' : ''}`}>
                        <td className="px-2 py-1.5 text-ink/40">{r.row_no}</td>
                        <td className="px-2 py-1.5">{r.nama || <span className="text-clay-dark italic">(kosong)</span>}</td>
                        <td className="px-2 py-1.5 text-ink/60">{r.no_wa}</td>
                        <td className="px-2 py-1.5 text-ink/60">{r.kategori ?? '—'}</td>
                        <td className="px-2 py-1.5">{r.unlimited ? '∞' : (r.sisa_sesi ?? '—')}</td>
                        <td className="px-2 py-1.5 text-ink/60">{r.expired ? formatDate(r.expired) : '—'}</td>
                        <td className="px-2 py-1.5">
                          {r.errors.length
                            ? <span className="text-clay-dark" title={r.errors.join('; ')}>⚠ {r.errors[0]}</span>
                            : <span className={r.action === 'create' ? 'text-emerald-700' : 'text-copper-700'}>{r.action === 'create' ? 'baru' : 'perbarui'}{r.has_package ? ' +paket' : ''}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <label className="label">Password awal (akun baru)</label>
                <input className="input" value={pwd} onChange={(e) => setPwd(e.target.value)} />
                <p className="text-[11px] text-ink/45 mt-1">Dipakai untuk akun baru. Member login pakai No. WA + password ini, lalu bisa ganti / reset via WA.</p>
              </div>
              <button onClick={doImport} disabled={busy || okCount === 0} className="btn-primary w-full">
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} Impor {okCount} baris sekarang
              </button>
            </>
          )}
        </div>
      )}
    </Modal>
  )
}
