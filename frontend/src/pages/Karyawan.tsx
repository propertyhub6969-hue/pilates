import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/services/api'
import type { Employee } from '@/types'
import { formatRupiah, formatDate } from '@/utils/format'
import Modal from '@/components/Modal'
import { Plus, Loader2, Pencil, Power, Contact } from 'lucide-react'

type Form = { id?: string; name: string; position: string; phone: string; pay_type: 'monthly' | 'per_session'; base_salary: string; session_rate: string; join_date: string; note: string }
const empty: Form = { name: '', position: '', phone: '', pay_type: 'monthly', base_salary: '', session_rate: '', join_date: '', note: '' }

export default function Karyawan() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [f, setF] = useState<Form>(empty)

  const { data, isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => (await api.get<Employee[]>('/employees')).data,
  })

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name: f.name, position: f.position || null, phone: f.phone || null,
        pay_type: f.pay_type,
        base_salary: f.pay_type === 'monthly' ? Number(f.base_salary || 0) : 0,
        session_rate: f.pay_type === 'per_session' ? Number(f.session_rate || 0) : 0,
        join_date: f.join_date || null, note: f.note || null,
      }
      if (f.id) return api.patch(`/employees/${f.id}`, body)
      return api.post('/employees', body)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); setOpen(false) },
    onError: (e: any) => setError(e?.response?.data?.detail ?? 'Gagal menyimpan'),
  })

  const toggle = useMutation({
    mutationFn: async (e: Employee) => e.is_active ? api.delete(`/employees/${e.id}`) : api.patch(`/employees/${e.id}`, { is_active: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  })

  function openNew() { setError(''); setF(empty); setOpen(true) }
  function openEdit(e: Employee) {
    setError('')
    setF({ id: e.id, name: e.name, position: e.position || '', phone: e.phone || '', pay_type: e.pay_type, base_salary: String(e.base_salary || ''), session_rate: String(e.session_rate || ''), join_date: e.join_date || '', note: e.note || '' })
    setOpen(true)
  }

  const rows = data ?? []

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">Data Karyawan</h1>
        <button onClick={openNew} className="btn-primary"><Plus size={16} /> Tambah Karyawan</button>
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink/45 text-xs uppercase tracking-wide border-b border-sand">
                <th className="font-semibold px-4 py-3">Nama</th>
                <th className="font-semibold px-4 py-3 hidden sm:table-cell">Jabatan</th>
                <th className="font-semibold px-4 py-3 hidden md:table-cell">No. HP</th>
                <th className="font-semibold px-4 py-3">Cara Bayar</th>
                <th className="font-semibold px-4 py-3 text-right">Gaji / Tarif</th>
                <th className="font-semibold px-4 py-3">Status</th>
                <th className="font-semibold px-4 py-3 text-right w-24">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? <tr><td colSpan={7} className="px-4 py-10 text-center text-ink/40">Memuat…</td></tr>
                : rows.length === 0 ? <tr><td colSpan={7} className="px-4 py-10 text-center text-ink/40"><Contact className="mx-auto mb-2 text-ink/30" size={26} />Belum ada karyawan.</td></tr>
                : rows.map((e) => (
                  <tr key={e.id} className={`border-b border-sand/60 last:border-0 hover:bg-sand/40 transition ${!e.is_active ? 'opacity-55' : ''}`}>
                    <td className="px-4 py-3 font-semibold">{e.name}</td>
                    <td className="px-4 py-3 text-ink/60 hidden sm:table-cell">{e.position || '—'}</td>
                    <td className="px-4 py-3 text-ink/60 hidden md:table-cell">{e.phone || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs rounded-full px-2 py-0.5 ${e.pay_type === 'per_session' ? 'bg-copper-50 text-copper-700 border border-copper-100' : 'bg-sand text-ink/60'}`}>
                        {e.pay_type === 'per_session' ? 'Per Sesi' : 'Bulanan'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium whitespace-nowrap">
                      {e.pay_type === 'per_session' ? <>{formatRupiah(e.session_rate)}<span className="text-ink/40 text-xs">/sesi</span></> : formatRupiah(e.base_salary)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs rounded-full px-2 py-0.5 ${e.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-sand text-ink/50'}`}>{e.is_active ? 'Aktif' : 'Non-aktif'}</span>
                    </td>
                    <td className="px-2">
                      <div className="flex items-center justify-end gap-0.5">
                        <button title="Ubah" onClick={() => openEdit(e)} className="btn-ghost !px-2 !py-1.5 text-ink/55"><Pencil size={15} /></button>
                        <button title={e.is_active ? 'Non-aktifkan' : 'Aktifkan'} onClick={() => toggle.mutate(e)} className={`btn-ghost !px-2 !py-1.5 ${e.is_active ? 'text-clay-dark' : 'text-emerald-600'}`}><Power size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={f.id ? 'Ubah Karyawan' : 'Tambah Karyawan'}>
        <form onSubmit={(e) => { e.preventDefault(); setError(''); save.mutate() }} className="space-y-4">
          <div><label className="label">Nama</label><input className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Jabatan</label><input className="input" value={f.position} onChange={(e) => setF({ ...f, position: e.target.value })} placeholder="Instruktur / Resepsionis…" /></div>
            <div><label className="label">No. HP</label><input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Cara Bayar</label>
              <select className="input" value={f.pay_type} onChange={(e) => setF({ ...f, pay_type: e.target.value as Form['pay_type'] })}>
                <option value="monthly">Gaji Bulanan</option>
                <option value="per_session">Per Sesi (pendamping)</option>
              </select>
            </div>
            {f.pay_type === 'monthly'
              ? <div><label className="label">Gaji Pokok (Rp)</label><input type="number" min={0} className="input" value={f.base_salary} onChange={(e) => setF({ ...f, base_salary: e.target.value })} placeholder="3000000" /></div>
              : <div><label className="label">Tarif per Sesi (Rp)</label><input type="number" min={0} className="input" value={f.session_rate} onChange={(e) => setF({ ...f, session_rate: e.target.value })} placeholder="50000" /></div>}
          </div>
          <div><label className="label">Tanggal Bergabung</label><input type="date" className="input" value={f.join_date} onChange={(e) => setF({ ...f, join_date: e.target.value })} /></div>
          {f.pay_type === 'per_session' && <p className="text-[11px] text-ink/45 -mt-2">Dibayar sesuai jumlah sesi yang didampingi (ditandai admin di roster tiap sesi). Payroll menghitung otomatis.</p>}
          <div><label className="label">Catatan</label><textarea className="input" rows={2} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
          {error && <div className="text-sm text-clay-dark bg-clay/10 border border-clay/20 rounded-lg px-3 py-2">{error}</div>}
          <button className="btn-primary w-full" disabled={save.isPending || !f.name}>{save.isPending && <Loader2 size={16} className="animate-spin" />} Simpan</button>
        </form>
      </Modal>
    </div>
  )
}
