import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api'
import type { FinancialAccount, ExpenseCategory } from '@/types'
import { EXPENSE_CATEGORY_LABEL } from '@/types'
import { formatRupiah } from '@/utils/format'
import { TrendingUp, TrendingDown, Wallet, Landmark, Scale } from 'lucide-react'

interface Report {
  date_from: string; date_to: string
  income: number; expense: number; net: number
  expense_by_category: { category: ExpenseCategory; amount: number }[]
  accounts: FinancialAccount[]
}

const firstOfMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10) }
const todayISO = () => new Date().toISOString().slice(0, 10)

export default function Laporan() {
  const [range, setRange] = useState({ from: firstOfMonth(), to: todayISO() })
  const { data, isLoading } = useQuery({
    queryKey: ['finance-report', range],
    queryFn: async () => (await api.get<Report>('/finance/report', { params: { from: range.from, to: range.to } })).data,
  })

  const cats = [...(data?.expense_by_category ?? [])].sort((a, b) => b.amount - a.amount)
  const maxCat = Math.max(1, ...cats.map((c) => c.amount))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold">Laporan Keuangan</h1>
        <p className="text-ink/50 text-sm">Ringkasan pemasukan, pengeluaran, dan saldo studio.</p>
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
                    <span className="text-ink/70">{EXPENSE_CATEGORY_LABEL[c.category]}</span>
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
        </>
      )}
    </div>
  )
}
