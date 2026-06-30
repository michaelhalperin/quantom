import { Link } from 'react-router-dom'
import type { Trade } from '@/types'
import { useSort } from '@/hooks/useSort'
import { SortTh, Th, Td, TableScroll } from '@/components/common/DataTableParts'
import { OutcomePill, SideTag } from '@/components/common/badges'
import { EmptyState } from '@/components/ui'
import {
  formatCents,
  formatCurrency,
  formatDateTime,
  formatNumber,
  formatSignedCurrency,
  pnlColor,
} from '@/lib/format'
import { cn } from '@/lib/utils'

export function TradesTable({ trades }: { trades: Trade[] }) {
  const { sorted, sortKey, dir, toggle } = useSort<Trade>(trades, 'timestamp')

  if (trades.length === 0) {
    return <EmptyState title="No trades found" description="Try adjusting your filters." />
  }

  return (
    <TableScroll>
      <thead>
        <tr className="border-b border-border">
          <SortTh label="Time" active={sortKey === 'timestamp'} dir={dir} onClick={() => toggle('timestamp')} />
          <SortTh label="Market" active={sortKey === 'question'} dir={dir} onClick={() => toggle('question')} />
          <Th>Outcome</Th>
          <Th>Side</Th>
          <SortTh label="Price" align="right" active={sortKey === 'price'} dir={dir} onClick={() => toggle('price')} />
          <SortTh label="Size" align="right" active={sortKey === 'size'} dir={dir} onClick={() => toggle('size')} />
          <SortTh label="Value" align="right" active={sortKey === 'value'} dir={dir} onClick={() => toggle('value')} />
          <Th align="right">Fee</Th>
          <SortTh label="Realized P&L" align="right" active={sortKey === 'pnl'} dir={dir} onClick={() => toggle('pnl')} />
        </tr>
      </thead>
      <tbody>
        {sorted.map((t) => (
          <tr key={t.id} className="border-b border-border/60 transition-colors hover:bg-surface-2/40">
            <Td className="whitespace-nowrap text-muted-2">{formatDateTime(t.timestamp)}</Td>
            <Td>
              <div className="flex items-center gap-2">
                <span>{t.icon}</span>
                <Link
                  to={`/markets/${t.marketId}`}
                  className="line-clamp-1 max-w-[15rem] text-[13px] text-foreground hover:text-primary"
                >
                  {t.question}
                </Link>
              </div>
            </Td>
            <Td>
              <OutcomePill side={t.outcome} />
            </Td>
            <Td>
              <SideTag side={t.side} />
            </Td>
            <Td align="right">{formatCents(t.price)}</Td>
            <Td align="right" className="text-muted">{formatNumber(t.size)}</Td>
            <Td align="right">{formatCurrency(t.value, 0)}</Td>
            <Td align="right" className="text-muted-2">{formatCurrency(t.fee)}</Td>
            <Td align="right">
              {t.pnl === null ? (
                <span className="text-muted-2">—</span>
              ) : (
                <span className={cn('font-medium tabular-nums', pnlColor(t.pnl))}>
                  {formatSignedCurrency(t.pnl, 0)}
                </span>
              )}
            </Td>
          </tr>
        ))}
      </tbody>
    </TableScroll>
  )
}
