import { Link } from 'react-router-dom'
import { useBotStore } from '@/store/useBotStore'
import { cn } from '@/lib/utils'
import { formatCents, formatPctPoints } from '@/lib/format'

export function MarketTicker() {
  const markets = useBotStore((s) => s.markets)
  if (!markets.length) return null
  const items = markets.slice(0, 18)

  return (
    <div className="relative hidden overflow-hidden border-b border-border bg-surface/30 md:block">
      <div className="flex w-max animate-marquee gap-8 py-2 pl-8 hover:[animation-play-state:paused]">
        {[...items, ...items].map((m, i) => (
          <Link
            to={`/markets/${m.id}`}
            key={i}
            className="flex items-center gap-2 text-xs whitespace-nowrap"
          >
            <span aria-hidden>{m.icon}</span>
            <span className="max-w-[15rem] truncate text-muted">{m.question}</span>
            <span className="font-semibold text-foreground tabular-nums">
              {formatCents(m.yesPrice)}
            </span>
            <span
              className={cn(
                'tabular-nums',
                m.change24h >= 0 ? 'text-profit' : 'text-loss',
              )}
            >
              {formatPctPoints(m.change24h)}
            </span>
          </Link>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent" />
    </div>
  )
}
