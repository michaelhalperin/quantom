import { useState } from 'react'
import type { Market, OrderType, OutcomeSide } from '@/types'
import { Button, Input, SegmentedControl } from '@/components/ui'
import { useBotStore } from '@/store/useBotStore'
import { useUIStore } from '@/store/useUIStore'
import { formatCents, formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'

export function TradePanel({ market }: { market: Market }) {
  const placeOrder = useBotStore((s) => s.placeOrder)
  const addToast = useUIStore((s) => s.addToast)

  const [outcome, setOutcome] = useState<OutcomeSide>('YES')
  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const [type, setType] = useState<OrderType>('limit')
  const refPrice = outcome === 'YES' ? market.yesPrice : market.noPrice
  const [priceCents, setPriceCents] = useState((refPrice * 100).toFixed(1))
  const [shares, setShares] = useState('100')

  const priceNum = type === 'market' ? refPrice : (Number(priceCents) || 0) / 100
  const sharesNum = Number(shares) || 0
  const cost = priceNum * sharesNum
  const payout = sharesNum
  const maxProfit = payout - cost

  const submit = () => {
    if (sharesNum <= 0) return
    placeOrder({ marketId: market.id, outcome, side, type, price: priceNum, size: sharesNum })
    addToast({
      variant: 'success',
      title: 'Order submitted',
      description: `${side.toUpperCase()} ${Math.round(sharesNum)} ${outcome} @ ${formatCents(priceNum)}`,
    })
    setShares('100')
  }

  const setPct = (pct: number) => {
    // size relative to a notional 5,000 of buying power, for demo purposes
    const target = Math.round((5000 * pct) / Math.max(priceNum, 0.01))
    setShares(String(target))
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {(['YES', 'NO'] as const).map((o) => {
          const p = o === 'YES' ? market.yesPrice : market.noPrice
          const activeSel = outcome === o
          return (
            <button
              key={o}
              type="button"
              onClick={() => {
                setOutcome(o)
                setPriceCents((p * 100).toFixed(1))
              }}
              className={cn(
                'flex flex-col items-center rounded-xl border py-2.5 transition-all',
                activeSel
                  ? o === 'YES'
                    ? 'border-yes/40 bg-yes/10'
                    : 'border-no/40 bg-no/10'
                  : 'border-border bg-surface-2/50 hover:border-border-strong',
              )}
            >
              <span className={cn('text-[11px] font-bold', o === 'YES' ? 'text-yes' : 'text-no')}>
                {o}
              </span>
              <span className="text-lg font-semibold text-foreground tabular-nums">
                {formatCents(p)}
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-between">
        <SegmentedControl
          options={[
            { label: 'Buy', value: 'buy' },
            { label: 'Sell', value: 'sell' },
          ]}
          value={side}
          onChange={setSide}
        />
        <SegmentedControl
          size="sm"
          options={[
            { label: 'Limit', value: 'limit' },
            { label: 'Market', value: 'market' },
          ]}
          value={type}
          onChange={setType}
        />
      </div>

      <div className="space-y-2.5">
        <div>
          <label className="mb-1 block text-[11px] font-medium text-muted">Limit price</label>
          <Input
            type="number"
            value={type === 'market' ? (refPrice * 100).toFixed(1) : priceCents}
            disabled={type === 'market'}
            onChange={(e) => setPriceCents(e.target.value)}
            rightSlot="¢"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-muted">Shares</label>
          <Input
            type="number"
            value={shares}
            onChange={(e) => setShares(e.target.value)}
            rightSlot="sh"
          />
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {[0.25, 0.5, 0.75, 1].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPct(p)}
              className="rounded-md border border-border bg-surface-2/50 py-1 text-[11px] font-medium text-muted transition-colors hover:text-foreground"
            >
              {p * 100}%
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5 rounded-xl border border-border bg-surface-2/40 p-3 text-[12px]">
        <Row label="Order cost" value={formatCurrency(cost)} />
        <Row label="Potential payout" value={formatCurrency(payout)} />
        <Row label="Max profit" value={formatCurrency(maxProfit)} valueClass="text-profit" />
      </div>

      <Button
        onClick={submit}
        className="w-full"
        size="lg"
        variant={side === 'buy' ? 'primary' : 'danger'}
      >
        {side === 'buy' ? 'Buy' : 'Sell'} {outcome} · {formatCurrency(cost)}
      </Button>
    </div>
  )
}

function Row({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className={cn('font-medium text-foreground tabular-nums', valueClass)}>{value}</span>
    </div>
  )
}
