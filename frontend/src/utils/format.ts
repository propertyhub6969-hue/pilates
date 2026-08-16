export function formatRupiah(v: number | string | null | undefined): string {
  const n = Number(v ?? 0)
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
  }).format(n)
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Link wa.me dari nomor Indonesia (0.. → 62..). null bila tak valid. */
export function waLink(phone: string | null | undefined): string | null {
  if (!phone) return null
  let d = phone.replace(/\D/g, '')
  if (!d) return null
  if (d.startsWith('0')) d = '62' + d.slice(1)
  else if (!d.startsWith('62')) d = '62' + d
  return `https://wa.me/${d}`
}

export function formatTime(t: string | null | undefined): string {
  if (!t) return '—'
  return t.slice(0, 5) // "07:00:00" → "07:00"
}

export function formatDayDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}
