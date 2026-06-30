import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useCountUp } from '@/hooks/useCountUp'
import { useFlash } from '@/hooks/useFlash'
import { Card, Sparkline } from '@/components/ui'

const accentMap = {
  primary: 'text-primary bg-primary/10',
  profit: 'text-profit bg-profit/10',
  loss: 'text-loss bg-loss/10',
  warning: 'text-warning bg-warning/10',
  accent: 'text-accent bg-accent/10',
}

export interface KpiCardProps {
  label: string
  value: number
  format: (n: number) => string
  icon?: ReactNode
  delta?: number
  deltaText?: string
  spark?: number[]
  accent?: keyof typeof accentMap
  valueColor?: string
  animate?: boolean
}

export function KpiCard({
  label,
  value,
  format,
  icon,
  delta,
  deltaText,
  spark,
  accent = 'primary',
  valueColor,
  animate = true,
}: KpiCardProps) {
  const animated = useCountUp(value)
  const shown = animate ? animated : value
  const dir = delta === undefined ? 0 : delta

  return (
    <Card className="relative overflow-hidden p-4">
      <div className="flex items-start justify-between">
        <span className="text-[11px] font-medium tracking-wide text-muted-2 uppercase">{label}</span>
        {icon && (
          <span className={cn('grid h-7 w-7 place-items-center rounded-lg', accentMap[accent])}>
            {icon}
          </span>
        )}
      </div>
      <div className={cn('mt-2 text-2xl font-semibold tracking-tight tabular-nums', valueColor ?? 'text-foreground')}>
        {format(shown)}
      </div>
      <div className="mt-1.5 flex items-end justify-between gap-2">
        {(delta !== undefined || deltaText) && (
          <span
            className={cn(
              'flex items-center gap-1 text-xs font-medium tabular-nums',
              dir > 0 && 'text-profit',
              dir < 0 && 'text-loss',
              dir === 0 && 'text-muted',
            )}
          >
            {dir !== 0 && <span className="text-[0.8em]">{dir > 0 ? '▲' : '▼'}</span>}
            {deltaText}
          </span>
        )}
        {spark && spark.length > 1 && (
          <Sparkline data={spark} width={80} height={28} className="opacity-90" />
        )}
      </div>
    </Card>
  )
}

/* Compact metric tile for dense grids */
export function StatTile({
  label,
  value,
  sub,
  valueClass,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  valueClass?: string
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-2/40 p-3.5">
      <div className="text-[11px] font-medium tracking-wide text-muted-2 uppercase">{label}</div>
      <div className={cn('mt-1 text-lg font-semibold text-foreground tabular-nums', valueClass)}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-muted">{sub}</div>}
    </div>
  )
}

/* Card with a header row + optional action, used across pages */
export function SectionCard({
  title,
  subtitle,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <Card className={cn('flex flex-col', className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <div className="min-w-0">
            {title && <h3 className="text-[13px] font-semibold text-foreground">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-[11px] text-muted">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={cn('flex-1 p-5', bodyClassName)}>{children}</div>
    </Card>
  )
}

/* Live-updating number that briefly tints on change */
export function LiveNumber({
  value,
  format,
  className,
}: {
  value: number
  format: (n: number) => string
  className?: string
}) {
  const dir = useFlash(value)
  return (
    <span
      className={cn(
        'tabular-nums transition-colors duration-700',
        dir === 'up' && 'text-profit',
        dir === 'down' && 'text-loss',
        className,
      )}
    >
      {format(value)}
    </span>
  )
}
