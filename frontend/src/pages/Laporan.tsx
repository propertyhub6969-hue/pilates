import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api'
import type { FinancialAccount, ExpenseCategory } from '@/types'
import { EXPENSE_CATEGORY_LABEL } from '@/types'
import { formatRupiah, formatDate } from '@/utils/format'
import { TrendingUp, TrendingDown, Wallet, Landmark, Scale, Printer, Sheet, Loader2 } from 'lucide-react'

interface Report {
  date_from: string; date_to: string
  income: number; expense: number; net: number
  expense_by_category: { category: ExpenseCategory; label?: string | null; amount: number }[]
  accounts: FinancialAccount[]
  transfers: { id: string; transfer_date: string; from_account_name?: string | null; to_account_name?: string | null; amount: number; description?: string | null }[]
}

// Tanggal zona studio (WITA), tahan bug UTC di dekat tengah malam.
const todayISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date())
const firstOfMonth = () => todayISO().slice(0, 8) + '01'

interface Studio { name: string; address?: string | null; phone?: string | null }

export default function Laporan() {
  const [range, setRange] = useState({ from: firstOfMonth(), to: todayISO() })
  const { data, isLoading } = useQuery({
    queryKey: ['finance-report', range],
    queryFn: async () => (await api.get<Report>('/finance/report', { params: { from: range.from, to: range.to } })).data,
  })
  const { data: studio } = useQuery({
    queryKey: ['studio-settings'],
    queryFn: async () => (await api.get<Studio>('/studio/settings')).data,
  })

  const cats = [...(data?.expense_by_category ?? [])].sort((a, b) => b.amount - a.amount)
  const maxCat = Math.max(1, ...cats.map((c) => c.amount))

  const [downloading, setDownloading] = useState(false)
  async function downloadExcel() {
    setDownloading(true)
    try {
      const res = await api.get('/finance/report.xlsx', { params: { from: range.from, to: range.to }, responseType: 'blob' })
      const url = URL.createObjectURL(res.data as Blob)
      const a = document.createElement('a'); a.href = url; a.download = `LabaRugi_${range.from}_${range.to}.xlsx`
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
    } catch { alert('Gagal mengunduh Excel.') }
    finally { setDownloading(false) }
  }

  function printReport() {
    if (!data) return
    const totalBalance = data.accounts.reduce((s, a) => s + (a.balance ?? 0), 0)
    const today = formatDate(todayISO())
    const rows = (arr: [string, number][]) =>
      arr.map(([k, v]) => `<tr><td>${k}</td><td class="amt">${formatRupiah(v)}</td></tr>`).join('')
    const catRows = cats.length
      ? cats.map((c) => `<tr><td>${c.label ?? EXPENSE_CATEGORY_LABEL[c.category] ?? c.category}</td><td class="amt">${formatRupiah(c.amount)}</td></tr>`).join('')
      : '<tr><td class="muted">Tidak ada pengeluaran</td><td></td></tr>'
    const accRows = data.accounts.length
      ? data.accounts.map((a) => `<tr><td>${a.name}${a.bank_name ? ` (${a.bank_name})` : ''}</td><td class="amt">${formatRupiah(a.balance)}</td></tr>`).join('')
      : '<tr><td class="muted">Belum ada akun</td><td></td></tr>'
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Laporan Keuangan — ${studio?.name ?? 'Reformer Your Body'}</title>
<style>
  *{box-sizing:border-box} body{font-family:'Segoe UI',Arial,sans-serif;color:#2A2724;margin:36px;font-size:14px}
  .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #A9654E;padding-bottom:14px}
  .studio{font-size:20px;font-weight:700;color:#8A5140}
  .muted{color:#888;font-size:12px}
  .title{font-weight:700;letter-spacing:.5px}
  h2{font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#A9654E;margin:22px 0 6px;border-bottom:1px solid #eee;padding-bottom:4px}
  table{width:100%;border-collapse:collapse} td{padding:5px 2px} td.amt{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
  .row-total td{border-top:1px solid #ccc;font-weight:700}
  .net{display:flex;justify-content:space-between;margin:18px 0;padding:12px 16px;background:#FBF1EB;border:1px solid #E8C2AF;border-radius:8px;font-weight:700;font-size:16px}
  .net .val{color:#8A5140}.net.neg .val{color:#A55B3B}
  .foot{margin-top:34px;font-size:11px;color:#aaa;text-align:center;border-top:1px solid #eee;padding-top:10px}
  @media print{body{margin:0;padding:24px}}
</style></head><body>
  <div class="header">
    <div><div class="studio">${studio?.name ?? 'Reformer Your Body'}</div>${studio?.address ? `<div class="muted">${studio.address}</div>` : ''}${studio?.phone ? `<div class="muted">${studio.phone}</div>` : ''}</div>
    <div style="text-align:right"><div class="title">LAPORAN KEUANGAN</div><div class="muted">Periode: ${formatDate(range.from)} – ${formatDate(range.to)}</div><div class="muted">Dicetak: ${today}</div></div>
  </div>

  <h2>Pendapatan</h2>
  <table>${rows([['Pendapatan member & kelas', data.income]])}<tr class="row-total"><td>Total Pendapatan</td><td class="amt">${formatRupiah(data.income)}</td></tr></table>

  <h2>Pengeluaran Operasional</h2>
  <table>${catRows}<tr class="row-total"><td>Total Pengeluaran</td><td class="amt">${formatRupiah(data.expense)}</td></tr></table>

  <div class="net ${data.net < 0 ? 'neg' : ''}"><span>${data.net >= 0 ? 'LABA BERSIH' : 'RUGI BERSIH'}</span><span class="val">${formatRupiah(data.net)}</span></div>

  <h2>Saldo Akun (saat cetak)</h2>
  <table>${accRows}<tr class="row-total"><td>Total Saldo</td><td class="amt">${formatRupiah(totalBalance)}</td></tr></table>

  <div class="foot">Dicetak otomatis oleh sistem ${studio?.name ?? 'Reformer Your Body'} · ${today}</div>
</body></html>`
    const w = window.open('', '_blank', 'width=820,height=1000')
    if (!w) { alert('Popup diblokir browser. Izinkan popup untuk mencetak.'); return }
    w.document.write(html); w.document.close(); w.focus()
    setTimeout(() => w.print(), 300)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Laporan Keuangan</h1>
          <p className="text-ink/50 text-sm">Ringkasan pemasukan, pengeluaran, dan saldo studio.</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={downloadExcel} disabled={!data || downloading} className="btn-ghost border border-sand">
            {downloading ? <Loader2 size={16} className="animate-spin" /> : <Sheet size={16} />} Excel
          </button>
          <button onClick={printReport} disabled={!data} className="btn-ghost border border-sand">
            <Printer size={16} /> Cetak
          </button>
        </div>
      </div>

      <div className="flex gap-2 items-end flex-wrap">
        <div><label className="label">Dari</label><input type="date" className="input" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></div>
        <div><label className="label">Sampai</label><input type="date" className="input" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></div>
      </div>

      {isLoading || !data ? <div className="text-ink/40 py-10 text-center">Memuat…</div> : (
        <>
          {/* KPI */}
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="card">
              <TrendingUp size={18} className="text-copper-600" />
              <div className="text-xs text-ink/50 mt-2">Pemasukan</div>
              <div className="font-display text-2xl font-semibold text-copper-700">{formatRupiah(data.income)}</div>
            </div>
            <div className="card">
              <TrendingDown size={18} className="text-clay-dark" />
              <div className="text-xs text-ink/50 mt-2">Pengeluaran</div>
              <div className="font-display text-2xl font-semibold text-clay-dark">{formatRupiah(data.expense)}</div>
            </div>
            <div className={`card ${data.net >= 0 ? 'bg-copper-50 border-copper-100' : 'bg-clay/5 border-clay/20'}`}>
              <Scale size={18} className={data.net >= 0 ? 'text-copper-600' : 'text-clay-dark'} />
              <div className="text-xs text-ink/50 mt-2">{data.net >= 0 ? 'Laba' : 'Rugi'} (bersih)</div>
              <div className={`font-display text-2xl font-semibold ${data.net >= 0 ? 'text-copper-700' : 'text-clay-dark'}`}>{formatRupiah(data.net)}</div>
            </div>
          </div>

          {/* Pengeluaran per kategori */}
          <div>
            <h2 className="font-display text-lg font-semibold mb-2">Pengeluaran per kategori</h2>
            <div className="card space-y-3">
              {cats.length === 0 && <div className="text-ink/40 text-sm text-center py-4">Belum ada pengeluaran di rentang ini.</div>}
              {cats.map((c) => (
                <div key={c.category}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-ink/70">{c.label ?? EXPENSE_CATEGORY_LABEL[c.category] ?? c.category}</span>
                    <span className="font-semibold">{formatRupiah(c.amount)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-sand overflow-hidden">
                    <div className="h-full bg-copper-500 rounded-full" style={{ width: `${(c.amount / maxCat) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Saldo akun */}
          <div>
            <h2 className="font-display text-lg font-semibold mb-2">Saldo Akun</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {data.accounts.map((a) => (
                <div key={a.id} className="card flex items-center gap-3">
                  <span className={`grid place-items-center w-10 h-10 rounded-xl ${a.type === 'cash' ? 'bg-copper-50 text-copper-600' : 'bg-sand text-ink/60'}`}>
                    {a.type === 'cash' ? <Wallet size={20} /> : <Landmark size={20} />}
                  </span>
                  <div className="flex-1">
                    <div className="font-semibold text-sm">{a.name}</div>
                    <div className="text-xs text-ink/45">{a.type === 'cash' ? 'Kas' : a.bank_name || 'Bank'}</div>
                  </div>
                  <div className="font-display text-lg font-semibold text-copper-700">{formatRupiah(a.balance)}</div>
                </div>
              ))}
              {data.accounts.length === 0 && <div className="text-ink/40 text-sm col-span-full text-center py-4">Belum ada akun kas/bank.</div>}
            </div>
          </div>

          {/* Transfer antar kas (tidak memengaruhi laba/rugi) */}
          {data.transfers.length > 0 && (
            <div>
              <h2 className="font-display text-lg font-semibold mb-1">Transfer Antar Kas</h2>
              <p className="text-xs text-ink/45 mb-2">Perpindahan saldo antar akun — tidak dihitung sebagai pemasukan/pengeluaran.</p>
              <div className="card !p-0 overflow-hidden">
                <table className="w-full text-sm">
                  <tbody>
                    {data.transfers.map((t) => (
                      <tr key={t.id} className="border-b border-sand/60 last:border-0">
                        <td className="px-4 py-2.5 text-ink/60 whitespace-nowrap">{formatDate(t.transfer_date)}</td>
                        <td className="px-4 py-2.5">
                          <span className="text-copper-700">{t.from_account_name || '—'}</span>
                          <span className="text-ink/40 mx-1.5">→</span>
                          <span className="text-emerald-700">{t.to_account_name || '—'}</span>
                          {t.description && <span className="text-ink/45"> · {t.description}</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold whitespace-nowrap">{formatRupiah(t.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
