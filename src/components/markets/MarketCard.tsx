import { Link } from 'react-router-dom'
import { Droplets, Users, Zap } from 'lucide-react'
import type { Market } from '@/types'
import { Badge, Card, Sparkline } from '@/components/ui'
import { formatCents, formatCompact, formatPctPoints } from '@/lib/format'
import { cn } from '@/lib/utils'

export function MarketCard({ market }: { market: Market }) {
  const spark = market.history.slice(-30).map((h) => h.p)
  return (
    <Link to={`/markets/${market.id}`} className="block">
      <Card className="group h-full p-4 transition-all hover:border-border-strong hover:shadow-md">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-xl">
            {market.icon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-[13px] leading-snug font-medium text-foreground">
              {market.question}
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-[11px] text-muted-2">{market.category}</span>
              {market.botActive && <Badge variant="info">Bot active</Badge>}
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-end justify-between">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-semibold text-foreground tabular-nums">
                {formatCents(market.yesPrice)}
              </span>
              <span
                className={cn(
                  'text-xs font-medium tabular-nums',
                  market.change24h >= 0 ? 'text-profit' : 'text-loss',
                )}
              >
                {formatPctPoints(market.change24h)}
              </span>
            </div>
            <div className="mt-0.5 text-[11px] text-muted-2">YES · {formatCents(market.noPrice)} NO</div>
          </div>
          <Sparkline data={spark} width={92} height={38} />
        </div>

        <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-no/30">
          <div className="bg-yes" style={{ width: `${market.yesPrice * 100}%` }} />
        </div>

        <div className="mt-3 flex items-center justify-between text-[11px] text-muted-2">
          <span className="flex items-center gap-1">
            <Droplets size={12} /> {formatCompact(market.liquidity, true)}
          </span>
          <span className="flex items-center gap-1">
            <Zap size={12} /> {formatCompact(market.volume24h, true)}
          </span>
          <span className="flex items-center gap-1">
            <Users size={12} /> {formatCompact(market.traders)}
          </span>
        </div>
      </Card>
    </Link>
  )
}
