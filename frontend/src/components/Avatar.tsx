import { useState, useEffect } from 'react'
import { UserRound } from 'lucide-react'
import type { User } from '@/types'

interface Props {
  user?: Pick<User, 'id' | 'full_name' | 'avatar_path' | 'updated_at'> | null
  size?: number
  className?: string
}

export function avatarUrl(user?: Props['user']): string | null {
  if (!user?.id || !user.avatar_path) return null
  const v = encodeURIComponent(user.updated_at || user.avatar_path)
  return `/api/v1/auth/users/${user.id}/avatar?v=${v}`
}

function initials(name?: string): string {
  if (!name) return ''
  const parts = name.trim().split(/\s+/)
  const a = parts[0]?.[0] ?? ''
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : ''
  return (a + b).slice(0, 2).toUpperCase()
}

export default function Avatar({ user, size = 40, className = '' }: Props) {
  const url = avatarUrl(user)
  const [broken, setBroken] = useState(false)
  useEffect(() => { setBroken(false) }, [url])

  const style = { width: size, height: size }
  const ini = initials(user?.full_name)

  if (url && !broken) {
    return (
      <img src={url} alt={user?.full_name ?? 'Foto'} onError={() => setBroken(true)}
        className={`rounded-full object-cover bg-sand ${className}`} style={style} />
    )
  }
  return (
    <span className={`grid place-items-center rounded-full bg-copper-100 text-copper-700 font-semibold ${className}`} style={style}>
      {ini ? <span style={{ fontSize: size * 0.4 }}>{ini}</span> : <UserRound size={size * 0.55} />}
    </span>
  )
}
