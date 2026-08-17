import { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api'
import { Bell, Receipt, Wallet, CalendarPlus, UserPlus } from 'lucide-react'

interface NotifItem {
  id: string
  type: 'proof' | 'payment' | 'booking' | 'member'
  title: string
  subtitle: string
  time: string
  link: string
}

const SEEN_KEY = 'ryb_notif_seen'

const ICON: Record<NotifItem['type'], any> = {
  proof: Receipt, payment: Wallet, booking: CalendarPlus, member: UserPlus,
}
const TONE: Record<NotifItem['type'], string> = {
  proof: 'bg-clay/15 text-clay-dark',
  payment: 'bg-copper-100 text-copper-700',
  booking: 'bg-copper-50 text-copper-600',
  member: 'bg-sand text-ink/60',
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (s < 60) return 'baru saja'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} mnt lalu`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} jam lalu`
  const d = Math.floor(h / 24)
  return `${d} hari lalu`
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [seen, setSeen] = useState<number>(() => Number(localStorage.getItem(SEEN_KEY) || 0))
  const navigate = useNavigate()

  const { data = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => (await api.get<NotifItem[]>('/notifications')).data,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })

  const unread = useMemo(
    () => data.filter((n) => new Date(n.time).getTime() > seen).length,
    [data, seen],
  )

  const wrap = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  function toggle() {
    const next = !open
    setOpen(next)
    if (next && data.length) {
      const now = Date.now()
      localStorage.setItem(SEEN_KEY, String(now))
      setSeen(now)
    }
  }

  function go(link: string) {
    setOpen(false)
    navigate(link)
  }

  return (
    <div className="relative shrink-0" ref={wrap}>
      <button onClick={toggle} className="relative grid place-items-center w-9 h-9 rounded-full hover:bg-sand transition" aria-label="Notifikasi">
        <Bell size={19} className="text-ink/70" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full bg-clay text-white text-[10px] font-bold leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-card border border-sand z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-sand flex items-center justify-between">
            <span className="font-semibold text-sm">Notifikasi</span>
            <span className="text-[11px] text-ink/40">{data.length} item</span>
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {data.length === 0 && (
              <div className="px-4 py-10 text-center text-ink/40 text-sm">Belum ada notifikasi.</div>
            )}
            {data.map((n) => {
              const Icon = ICON[n.type]
              const isNew = new Date(n.time).getTime() > seen
              return (
                <button key={n.id} onClick={() => go(n.link)}
                  className={`flex items-start gap-3 w-full text-left px-4 py-3 hover:bg-cream transition border-b border-sand/60 last:border-0 ${isNew ? 'bg-copper-50/40' : ''}`}>
                  <span className={`grid place-items-center w-9 h-9 rounded-xl shrink-0 ${TONE[n.type]}`}>
                    <Icon size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="font-semibold text-sm truncate">{n.title}</span>
                      {isNew && <span className="w-1.5 h-1.5 rounded-full bg-clay shrink-0" />}
                    </span>
                    <span className="block text-xs text-ink/55 truncate">{n.subtitle}</span>
                    <span className="block text-[11px] text-ink/35 mt-0.5">{timeAgo(n.time)}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
