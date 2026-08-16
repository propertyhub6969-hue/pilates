import { ReactNode } from 'react'
import { X } from 'lucide-react'

export default function Modal({
  open, onClose, title, children, maxWidth = 'max-w-md',
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  maxWidth?: string
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div className={`relative w-full ${maxWidth} bg-cream rounded-t-xl2 sm:rounded-xl2 shadow-card max-h-[92vh] overflow-y-auto`}>
        <div className="sticky top-0 bg-cream/95 backdrop-blur flex items-center justify-between px-5 py-4 border-b border-sand">
          <h3 className="font-display text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="btn-ghost !px-2 !py-2"><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
