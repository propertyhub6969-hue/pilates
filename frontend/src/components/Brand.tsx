import { useState } from 'react'
import { clsx } from 'clsx'

// Menampilkan logo studio dari /brand/logo.(png|jpg). Taruh file di /opt/pilates/brand/.
// Coba .png dulu lalu .jpg; bila keduanya tak ada → fallback wordmark "R + Reformer Your Body".
const SOURCES = ['/brand/logo.png', '/brand/logo.jpg']

export default function Brand({
  className,
  imgClassName,
  size = 'md',
}: {
  className?: string
  imgClassName?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const [idx, setIdx] = useState(0)
  const h = { sm: 'h-9', md: 'h-11', lg: 'h-20' }[size]

  if (idx < SOURCES.length) {
    return (
      <img
        src={SOURCES[idx]}
        alt="Reformer Your Body"
        onError={() => setIdx((i) => i + 1)}
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
