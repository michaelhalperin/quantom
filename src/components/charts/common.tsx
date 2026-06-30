import type { ReactNode } from 'react'
import { PieChart, Pie, Cell } from 'recharts'
import { cn } from '@/lib/utils'

export interface TooltipItem {
  name?: string
  value?: number | string
  color?: string
  dataKey?: string | number
  payload?: Record<string, unknown>
}

export interface ChartTooltipProps {
  active?: boolean
  payload?: TooltipItem[]
  label?: string | number
  formatter?: (value: number, item: TooltipItem) => ReactNode
  labelFormatter?: (label: string | number) => ReactNode
  hideLabel?: boolean
}

/** Shared Recharts tooltip card. */
export function ChartTooltip({
  active,
  payload,
  label,
  formatter,
  labelFormatter,
  hideLabel,
}: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="glass min-w-[8rem] rounded-lg border border-border px-3 py-2 text-xs shadow-xl">
      {!hideLabel && label !== undefined && (
        <div className="mb-1.5 text-[11px] font-medium text-muted">
          {labelFormatter ? labelFormatter(label) : label}
        </div>
      )}
      <div className="space-y-1">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center justify-between gap-5">
            <span className="flex items-center gap-1.5 text-muted">
              <span className="h-2 w-2 rounded-[3px]" style={{ background: p.color }} />
              {p.name}
            </span>
            <span className="font-semibold text-foreground tabular-nums">
              {formatter && typeof p.value === 'number' ? formatter(p.value, p) : p.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ----------------------------------- Donut -------------------------------- */
export interface DonutDatum {
  name: string
  value: number
  color: string
}

export function Donut({
  data,
  size = 160,
  thickness = 16,
  centerLabel,
  centerValue,
}: {
  data: DonutDatum[]
  size?: number
  thickness?: number
  centerLabel?: ReactNode
  centerValue?: ReactNode
}) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <PieChart width={size} height={size}>
        <Pie
          data={data}
          dataKey="value"
          innerRadius={size / 2 - thickness}
          outerRadius={size / 2}
          paddingAngle={data.length > 1 ? 2 : 0}
          stroke="none"
          startAngle={90}
          endAngle={-270}
          isAnimationActive={false}
        >
          {data.map((d, i) => (
            <Cell key={i} fill={d.color} />
          ))}
        </Pie>
      </PieChart>
      {(centerValue || centerLabel) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {centerValue && (
            <span className="text-xl font-semibold text-foreground tabular-nums">{centerValue}</span>
          )}
          {centerLabel && <span className="text-[11px] text-muted">{centerLabel}</span>}
        </div>
      )}
    </div>
  )
}

/* --------------------------------- BarList -------------------------------- */
export interface BarListItem {
  name: ReactNode
  value: number
  color?: string
  badge?: ReactNode
}

export function BarList({
  data,
  valueFormatter,
  className,
}: {
  data: BarListItem[]
  valueFormatter?: (v: number) => string
  className?: string
}) {
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <div className={cn('space-y-1.5', className)}>
      {data.map((d, i) => (
        <div key={i} className="relative flex h-8 items-center justify-between overflow-hidden rounded-md">
          <div
            className="absolute inset-y-0 left-0 rounded-md transition-all"
            style={{
              width: `${Math.max(2, (d.value / max) * 100)}%`,
              background: d.color ?? 'var(--primary-soft)',
            }}
          />
          <div className="relative z-10 flex min-w-0 items-center gap-2 pl-2.5">
            <span className="truncate text-[13px] text-foreground">{d.name}</span>
            {d.badge}
          </div>
          <span className="relative z-10 pr-2.5 text-[13px] font-medium text-foreground tabular-nums">
            {valueFormatter ? valueFormatter(d.value) : d.value}
          </span>
        </div>
      ))}
    </div>
  )
}
