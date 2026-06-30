import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { useUIStore } from '@/store/useUIStore'
import { cn } from '@/lib/utils'

const icons = {
  default: Info,
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
}
const colors = {
  default: 'text-primary',
  success: 'text-profit',
  error: 'text-loss',
  warning: 'text-warning',
}

export function Toaster() {
  const toasts = useUIStore((s) => s.toasts)
  const remove = useUIStore((s) => s.removeToast)

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[80] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const Icon = icons[t.variant]
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 48, transition: { duration: 0.15 } }}
              className="pointer-events-auto flex items-start gap-3 rounded-xl border border-border bg-surface p-3 shadow-xl"
            >
              <Icon size={18} className={cn('mt-0.5 shrink-0', colors[t.variant])} />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-foreground">{t.title}</p>
                {t.description && <p className="mt-0.5 text-xs text-muted">{t.description}</p>}
              </div>
              <button
                type="button"
                onClick={() => remove(t.id)}
                className="text-muted-2 transition-colors hover:text-foreground"
                aria-label="Dismiss"
              >
                <X size={15} />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
