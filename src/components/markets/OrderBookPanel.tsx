import type { OrderBook, OrderBookLevel } from '@/types'
import { formatCents, formatCompact } from '@/lib/format'
import { cn } from '@/lib/utils'

function Row({
  level,
  side,
  maxTotal,
}: {
  level: OrderBookLevel
  side: 'bid' | 'ask'
  maxTotal: number
}) {
  return (
    <div className="relative flex items-center justify-between px-3 py-1 text-[12px] tabular-nums">
      <div
        className={cn('absolute inset-y-0 right-0', side === 'bid' ? 'bg-yes/10' : 'bg-no/10')}
        style={{ width: `${(level.total / maxTotal) * 100}%` }}
      />
      <span className={cn('relative z-10 font-medium', side === 'bid' ? 'text-yes' : 'text-no')}>
        {formatCents(level.price)}
      </span>
      <span className="relative z-10 text-muted">{formatCompact(level.size)}</span>
      <span className="relative z-10 text-muted-2">{formatCompact(level.total)}</span>
    </div>
  )
}

export function OrderBookPanel({ book }: { book: OrderBook }) {
  const maxTotal = Math.max(
    book.bids[book.bids.length - 1]?.total ?? 0,
    book.asks[book.asks.length - 1]?.total ?? 0,
    1,
  )

  return (
    <div>
      <div className="flex justify-between px-3 pb-1.5 text-[10px] font-medium tracking-wide text-muted-2 uppercase">
        <span>Price</span>
        <span>Size</span>
        <span>Total</span>
      </div>
      <div className="space-y-px">
        {[...book.asks]
          .slice(0, 8)
          .reverse()
          .map((l, i) => (
            <Row key={`a${i}`} level={l} side="ask" maxTotal={maxTotal} />
          ))}
      </div>
      <div className="my-1.5 flex items-center justify-between border-y border-border px-3 py-1.5">
        <span className="text-[13px] font-semibold text-foreground tabular-nums">
          {formatCents(book.midpoint)}
        </span>
        <span className="text-[11px] text-muted-2">
          Spread {(book.spread * 100).toFixed(1)}¢
        </span>
      </div>
      <div className="space-y-px">
        {book.bids.slice(0, 8).map((l, i) => (
          <Row key={`b${i}`} level={l} side="bid" maxTotal={maxTotal} />
        ))}
      </div>
    </div>
  )
}
