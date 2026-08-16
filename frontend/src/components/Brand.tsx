import { useState } from 'react'
import { clsx } from 'clsx'

// Menampilkan logo studio dari /logo.png (taruh file di frontend/public/logo.png).
// Bila file belum ada / gagal dimuat → fallback ke wordmark "R + Reformer Your Body".
export default function Brand({
  className,
  imgClassName,
  size = 'md',
}: {
  className?: string
  imgClassName?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const [broken, setBroken] = useState(false)
  const h = { sm: 'h-9', md: 'h-11', lg: 'h-20' }[size]

  if (!broken) {
    return (
      <img
        src="/brand/logo.png"
        alt="Reformer Your Body"
        onError={() => setBroken(true)}
        className={clsx(h, 'w-auto object-contain', imgClassName, className)}
      />
    )
  }
  // Fallback wordmark
  const dot = { sm: 'w-9 h-9', md: 'w-10 h-10', lg: 'w-14 h-14' }[size]
  return (
    <span className={clsx('flex items-center gap-2', className)}>
      <span className={clsx(dot, 'grid place-items-center rounded-full bg-copper-600 text-white font-display font-semibold')}>R</span>
      <span className="font-display font-semibold tracking-tight">Reformer Your Body</span>
    </span>
  )
}
