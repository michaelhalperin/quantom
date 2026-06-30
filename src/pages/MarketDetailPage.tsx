import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarClock, Droplets, Zap } from 'lucide-react'
import { useBotStore } from '@/store/useBotStore'
import { api } from '@/data/api'
import type { OrderBook } from '@/types'
import { SectionCard, StatTile } from '@/components/dashboard/widgets'
import { PriceChart, DepthChart } from '@/components/charts'
import { OrderBookPanel } from '@/components/markets/OrderBookPanel'
import { TradePanel } from '@/components/markets/TradePanel'
import { TradesTable } from '@/components/trades/TradesTable'
import { PositionsTable } from '@/components/positions/PositionsTable'
import { MarketStatusBadge } from '@/components/common/badges'
import { Badge, Button, Card, EmptyState, SegmentedControl } from '@/components/ui'
import {
  formatCents,
  formatCompact,
  formatDate,
  formatPctPoints,
  formatRelativeTime,
} from '@/lib/format'
import { cn } from '@/lib/utils'

const TF = { '1W': 7, '1M': 30, '3M': 90 } as const
type Tf = keyof typeof TF

export function MarketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const market = useBotStore((s) => s.markets.find((m) => m.id === id))
  const trades = useBotStore((s) => s.trades)
  const positions = useBotStore((s) => s.positions)
  const [tf, setTf] = useState<Tf>('1M')

  const [book, setBook] = useState<OrderBook | null>(null)

  useEffect(() => {
    if (!market) {
      setBook(null)
      return
    }
    let cancelled = false
    void api.getOrderBook(market).then((b) => {
      if (!cancelled) setBook(b)
    })
    return () => {
      cancelled = true
    }
    // re-fetch as the mid drifts (every ~2¢)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market?.id, market ? Math.round(market.yesPrice * 50) : 0])

  if (!market) {
    return (
      <div>
        <Link to="/markets" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
          <ArrowLeft size={15} /> Back to markets
        </Link>
        <Card>
          <EmptyState title="Market not found" description="This market may have resolved or been removed." action={<Link to="/markets"><Button variant="secondary" size="sm">Browse markets</Button></Link>} />
        </Card>
      </div>
    )
  }

  const priceData = [...market.history.slice(-TF[tf]), { t: Date.now(), p: market.yesPrice }]
  const marketTrades = trades.filter((t) => t.marketId === market.id).slice(0, 12)
  const marketPositions = positions.filter((p) => p.marketId === market.id)

  return (
    <div>
      <Link to="/markets" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft size={15} /> Markets
      </Link>

      {/* Header */}
      <Card className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-surface-2 text-3xl">
              {market.icon}
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-foreground">{market.question}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <MarketStatusBadge status={market.status} />
                <Badge variant="outline">{market.category}</Badge>
                {market.botActive && <Badge variant="info" dot>Bot active</Badge>}
                {market.tags.map((t) => (
                  <span key={t} className="text-[11px] text-muted-2">
                    #{t}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-8">
            <div>
              <div className="text-[11px] font-medium tracking-wide text-muted-2 uppercase">YES</div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-yes tabular-nums">{formatCents(market.yesPrice)}</span>
                <span className={cn('text-sm font-medium tabular-nums', market.change24h >= 0 ? 'text-profit' : 'text-loss')}>
                  {formatPctPoints(market.change24h)}
                </span>
              </div>
            </div>
            <div>
              <div className="text-[11px] font-medium tracking-wide text-muted-2 uppercase">NO</div>
              <span className="text-3xl font-bold text-no tabular-nums">{formatCents(market.noPrice)}</span>
            </div>
          </div>
        </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Left: charts + history */}
        <div className="space-y-4 lg:col-span-2">
          <SectionCard
            title="Price history"
            subtitle="Implied YES probability"
            action={
              <SegmentedControl
                size="sm"
                value={tf}
                onChange={setTf}
                options={[
                  { label: '1W', value: '1W' },
                  { label: '1M', value: '1M' },
                  { label: '3M', value: '3M' },
                ]}
              />
            }
            bodyClassName="pt-3"
          >
            <PriceChart data={priceData} />
          </SectionCard>

          <SectionCard title="Market depth" subtitle="Cumulative order book liquidity" bodyClassName="pt-3">
            {book && <DepthChart book={book} />}
          </SectionCard>

          {marketPositions.length > 0 && (
            <SectionCard title="Your positions in this market" bodyClassName="p-0">
              <PositionsTable positions={marketPositions} />
            </SectionCard>
          )}

          <SectionCard title="Recent trades" bodyClassName="p-0">
            <TradesTable trades={marketTrades} />
          </SectionCard>
        </div>

        {/* Right: trade ticket + book + stats */}
        <div className="space-y-4">
          <SectionCard title="Place order">
            <TradePanel market={market} />
          </SectionCard>

          <SectionCard title="Order book" bodyClassName="px-0 py-2">
            {book && <OrderBookPanel book={book} />}
          </SectionCard>

          <SectionCard title="Market stats">
            <div className="grid grid-cols-2 gap-3">
              <StatTile label="24h volume" value={formatCompact(market.volume24h, true)} />
              <StatTile label="Total volume" value={formatCompact(market.volumeTotal, true)} />
              <StatTile label="Liquidity" value={formatCompact(market.liquidity, true)} />
              <StatTile label="Open interest" value={formatCompact(market.openInterest, true)} />
              <StatTile label="Spread" value={`${(market.spread * 100).toFixed(1)}¢`} />
              <StatTile label="Traders" value={formatCompact(market.traders)} />
            </div>
            <div className="mt-3 space-y-1.5 border-t border-border pt-3 text-[12px]">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-muted"><CalendarClock size={13} /> Resolves</span>
                <span className="text-foreground">{formatDate(market.endDate)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-muted"><Zap size={13} /> Created</span>
                <span className="text-foreground">{formatRelativeTime(market.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-muted"><Droplets size={13} /> Best bid / ask</span>
                <span className="text-foreground tabular-nums">{formatCents(market.bestBid)} / {formatCents(market.bestAsk)}</span>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
