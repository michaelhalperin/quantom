import {
  AlertTriangle,
  ArrowLeftRight,
  CheckCircle2,
  Info,
  XCircle,
  Zap,
} from 'lucide-react'
import type { ActivityEvent, ActivityLevel } from '@/types'
import { formatRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/ui'

const levelMap: Record<ActivityLevel, { icon: typeof Info; color: string }> = {
  trade: { icon: ArrowLeftRight, color: 'text-primary bg-primary/10' },
  signal: { icon: Zap, color: 'text-accent bg-accent/10' },
  success: { icon: CheckCircle2, color: 'text-profit bg-profit/10' },
  warning: { icon: AlertTriangle, color: 'text-warning bg-warning/10' },
  error: { icon: XCircle, color: 'text-loss bg-loss/10' },
  info: { icon: Info, color: 'text-muted bg-surface-2' },
}

export function ActivityFeed({ events, limit }: { events: ActivityEvent[]; limit?: number }) {
  const list = limit ? events.slice(0, limit) : events
  if (list.length === 0) {
    return <EmptyState title="No activity yet" description="Bot events will stream in here." />
  }
  return (
    <div className="space-y-0.5">
      {list.map((e) => {
        const m = levelMap[e.level]
        const Icon = m.icon
        return (
          <div key={e.id} className="flex gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-surface-2/50">
            <span className={cn('mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg', m.color)}>
              <Icon size={14} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] leading-snug text-foreground">{e.message}</p>
              {e.detail && <p className="mt-0.5 truncate text-[11px] text-muted-2">{e.detail}</p>}
            </div>
            <span className="shrink-0 text-[11px] whitespace-nowrap text-muted-2">
              {formatRelativeTime(e.timestamp)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
