import { Link } from 'react-router-dom'
import { Moon, Sun } from 'lucide-react'
import type { BotConnection } from '@/types'
import { useUIStore } from '@/store/useUIStore'
import { cn } from '@/lib/utils'

export function StatusDot({
  status,
  className,
}: {
  status: BotConnection | boolean
  className?: string
}) {
  const ok = status === 'connected' || status === true
  const degraded = status === 'degraded'
  const color = ok ? 'bg-profit' : degraded ? 'bg-warning' : 'bg-loss'
  return (
    <span className={cn('relative flex h-2 w-2', className)}>
      <span
        className={cn(
          'absolute inline-flex h-full w-full rounded-full opacity-60',
          color,
          ok && 'animate-ping',
        )}
      />
      <span className={cn('relative inline-flex h-2 w-2 rounded-full', color)} />
    </span>
  )
}

export function Logo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <div className="relative grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/30">
        <span className="text-base font-bold text-white">Q</span>
        <span className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent" />
      </div>
      {!collapsed && (
        <div className="leading-none">
          <div className="text-sm font-bold tracking-tight text-foreground">Quantum</div>
          <div className="mt-0.5 text-[10px] font-medium tracking-wide text-muted-2 uppercase">
            Polymarket Bot
          </div>
        </div>
      )}
    </Link>
  )
}

export function ThemeToggle() {
  const theme = useUIStore((s) => s.theme)
  const toggle = useUIStore((s) => s.toggleTheme)
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle theme"
      className="grid h-9 w-9 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
    >
      {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  )
}
