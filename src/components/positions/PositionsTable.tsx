import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import type { Position } from '@/types'
import { useSort } from '@/hooks/useSort'
import { useBotStore } from '@/store/useBotStore'
import { useUIStore } from '@/store/useUIStore'
import { SortTh, Th, Td, TableScroll } from '@/components/common/DataTableParts'
import { OutcomePill } from '@/components/common/badges'
import { LiveNumber } from '@/components/dashboard/widgets'
import { Button, EmptyState, Modal } from '@/components/ui'
import {
  formatCents,
  formatCurrency,
  formatPctPoints,
  formatShares,
  formatSignedCurrency,
  pnlColor,
} from '@/lib/format'
import { cn } from '@/lib/utils'

export function PositionsTable({ positions }: { positions: Position[] }) {
  const { sorted, sortKey, dir, toggle } = useSort<Position>(positions, 'value')
  const closePosition = useBotStore((s) => s.closePosition)
  const addToast = useUIStore((s) => s.addToast)
  const [closing, setClosing] = useState<Position | null>(null)

  const confirmClose = () => {
    if (!closing) return
    closePosition(closing.id)
    addToast({
      variant: closing.unrealizedPnl >= 0 ? 'success' : 'warning',
      title: 'Position closed',
      description: `${closing.side} · ${formatSignedCurrency(closing.unrealizedPnl, 0)} realized`,
    })
    setClosing(null)
  }

  if (positions.length === 0) {
    return <EmptyState title="No open positions" description="The bot has no active exposure right now." />
  }

  return (
    <>
      <TableScroll>
        <thead>
          <tr className="border-b border-border">
            <SortTh label="Market" active={sortKey === 'question'} dir={dir} onClick={() => toggle('question')} />
            <SortTh label="Shares" align="right" active={sortKey === 'shares'} dir={dir} onClick={() => toggle('shares')} />
            <SortTh label="Avg" align="right" active={sortKey === 'avgPrice'} dir={dir} onClick={() => toggle('avgPrice')} />
            <SortTh label="Mark" align="right" active={sortKey === 'currentPrice'} dir={dir} onClick={() => toggle('currentPrice')} />
            <SortTh label="Value" align="right" active={sortKey === 'value'} dir={dir} onClick={() => toggle('value')} />
            <SortTh label="Unreal. P&L" align="right" active={sortKey === 'unrealizedPnl'} dir={dir} onClick={() => toggle('unrealizedPnl')} />
            <Th align="right" aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr key={p.id} className="border-b border-border/60 transition-colors hover:bg-surface-2/40">
              <Td>
                <div className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-base">
                    {p.icon}
                  </span>
                  <div className="min-w-0">
                    <Link
                      to={`/markets/${p.marketId}`}
                      className="line-clamp-1 max-w-[20rem] text-[13px] font-medium text-foreground hover:text-primary"
                    >
                      {p.question}
                    </Link>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <OutcomePill side={p.side} />
                      <span className="text-[11px] text-muted-2">{p.strategyName}</span>
                    </div>
                  </div>
                </div>
              </Td>
              <Td align="right" className="text-muted">{formatShares(p.shares)}</Td>
              <Td align="right" className="text-muted">{formatCents(p.avgPrice)}</Td>
              <Td align="right">
                <LiveNumber value={p.currentPrice} format={formatCents} />
              </Td>
              <Td align="right">
                <LiveNumber value={p.value} format={(v) => formatCurrency(v, 0)} />
              </Td>
              <Td align="right">
                <div className={cn('font-medium tabular-nums', pnlColor(p.unrealizedPnl))}>
                  {formatSignedCurrency(p.unrealizedPnl, 0)}
                </div>
                <div className={cn('text-[11px] tabular-nums', pnlColor(p.unrealizedPnl))}>
                  {formatPctPoints(p.unrealizedPnlPct)}
                </div>
              </Td>
              <Td align="right">
                <button
                  type="button"
                  onClick={() => setClosing(p)}
                  title="Close position"
                  className="grid h-7 w-7 place-items-center rounded-md text-muted-2 transition-colors hover:bg-loss/10 hover:text-loss"
                >
                  <X size={15} />
                </button>
              </Td>
            </tr>
          ))}
        </tbody>
      </TableScroll>

      <Modal
        open={!!closing}
        onClose={() => setClosing(null)}
        title="Close position"
        description={closing?.question}
        footer={
          <>
            <Button variant="ghost" onClick={() => setClosing(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmClose}>
              Close at market
            </Button>
          </>
        }
      >
        {closing && (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Info label="Side" value={<OutcomePill side={closing.side} />} />
            <Info label="Shares" value={formatShares(closing.shares)} />
            <Info label="Avg price" value={formatCents(closing.avgPrice)} />
            <Info label="Mark price" value={formatCents(closing.currentPrice)} />
            <Info label="Market value" value={formatCurrency(closing.value)} />
            <Info
              label="Est. realized P&L"
              value={
                <span className={pnlColor(closing.unrealizedPnl)}>
                  {formatSignedCurrency(closing.unrealizedPnl)}
                </span>
              }
            />
          </div>
        )}
      </Modal>
    </>
  )
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface-2/40 p-2.5">
      <div className="text-[11px] text-muted-2">{label}</div>
      <div className="mt-0.5 font-medium text-foreground tabular-nums">{value}</div>
    </div>
  )
}
