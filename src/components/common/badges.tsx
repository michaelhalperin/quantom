import type {
  MarketStatus,
  OrderSide,
  OrderStatus,
  OutcomeSide,
  StrategyStatus,
} from '@/types'
import { Badge } from '@/components/ui'
import { cn } from '@/lib/utils'

export function OutcomePill({ side, className }: { side: OutcomeSide; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-bold',
        side === 'YES' ? 'bg-yes/15 text-yes' : 'bg-no/15 text-no',
        className,
      )}
    >
      {side}
    </span>
  )
}

export function SideTag({ side }: { side: OrderSide }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold capitalize',
        side === 'buy' ? 'bg-profit/12 text-profit' : 'bg-loss/12 text-loss',
      )}
    >
      {side}
    </span>
  )
}

const marketStatusMap: Record<MarketStatus, { label: string; variant: 'success' | 'warning' | 'muted' | 'info' }> = {
  active: { label: 'Active', variant: 'success' },
  'closing-soon': { label: 'Closing soon', variant: 'warning' },
  paused: { label: 'Paused', variant: 'muted' },
  resolved: { label: 'Resolved', variant: 'info' },
}

export function MarketStatusBadge({ status }: { status: MarketStatus }) {
  const s = marketStatusMap[status]
  return (
    <Badge variant={s.variant} dot={status === 'active'}>
      {s.label}
    </Badge>
  )
}

const orderStatusMap: Record<OrderStatus, { label: string; variant: 'info' | 'warning' | 'success' | 'muted' | 'danger' }> = {
  open: { label: 'Open', variant: 'info' },
  partial: { label: 'Partial', variant: 'warning' },
  filled: { label: 'Filled', variant: 'success' },
  cancelled: { label: 'Cancelled', variant: 'muted' },
  rejected: { label: 'Rejected', variant: 'danger' },
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const s = orderStatusMap[status]
  return <Badge variant={s.variant}>{s.label}</Badge>
}

const strategyStatusMap: Record<StrategyStatus, { label: string; variant: 'success' | 'warning' | 'muted' | 'danger' }> = {
  running: { label: 'Running', variant: 'success' },
  paused: { label: 'Paused', variant: 'warning' },
  stopped: { label: 'Stopped', variant: 'muted' },
  error: { label: 'Error', variant: 'danger' },
}

export function StrategyStatusBadge({ status }: { status: StrategyStatus }) {
  const s = strategyStatusMap[status]
  return (
    <Badge variant={s.variant} dot={status === 'running'}>
      {s.label}
    </Badge>
  )
}
