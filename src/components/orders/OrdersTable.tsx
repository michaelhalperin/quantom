import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import type { Order } from '@/types'
import { useSort } from '@/hooks/useSort'
import { useBotStore } from '@/store/useBotStore'
import { useUIStore } from '@/store/useUIStore'
import { SortTh, Th, Td, TableScroll } from '@/components/common/DataTableParts'
import { OrderStatusBadge, OutcomePill, SideTag } from '@/components/common/badges'
import { EmptyState, ProgressBar } from '@/components/ui'
import { formatCents, formatNumber, formatRelativeTime } from '@/lib/format'

export function OrdersTable({ orders }: { orders: Order[] }) {
  const { sorted, sortKey, dir, toggle } = useSort<Order>(orders, 'createdAt')
  const cancelOrder = useBotStore((s) => s.cancelOrder)
  const addToast = useUIStore((s) => s.addToast)

  if (orders.length === 0) {
    return <EmptyState title="No open orders" description="Resting orders will appear here once placed." />
  }

  return (
    <TableScroll>
      <thead>
        <tr className="border-b border-border">
          <SortTh label="Market" active={sortKey === 'question'} dir={dir} onClick={() => toggle('question')} />
          <Th>Outcome</Th>
          <Th>Side</Th>
          <SortTh label="Type" active={sortKey === 'type'} dir={dir} onClick={() => toggle('type')} />
          <SortTh label="Price" align="right" active={sortKey === 'price'} dir={dir} onClick={() => toggle('price')} />
          <SortTh label="Size" align="right" active={sortKey === 'size'} dir={dir} onClick={() => toggle('size')} />
          <Th align="right">Filled</Th>
          <SortTh label="Status" align="center" active={sortKey === 'status'} dir={dir} onClick={() => toggle('status')} />
          <SortTh label="Age" align="right" active={sortKey === 'createdAt'} dir={dir} onClick={() => toggle('createdAt')} />
          <Th align="right" aria-label="Actions" />
        </tr>
      </thead>
      <tbody>
        {sorted.map((o) => (
          <tr key={o.id} className="border-b border-border/60 transition-colors hover:bg-surface-2/40">
            <Td>
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-base">
                  {o.icon}
                </span>
                <Link
                  to={`/markets/${o.marketId}`}
                  className="line-clamp-1 max-w-[16rem] text-[13px] font-medium text-foreground hover:text-primary"
                >
                  {o.question}
                </Link>
              </div>
            </Td>
            <Td>
              <OutcomePill side={o.outcome} />
            </Td>
            <Td>
              <SideTag side={o.side} />
            </Td>
            <Td className="text-muted capitalize">{o.type}</Td>
            <Td align="right">{formatCents(o.price)}</Td>
            <Td align="right" className="text-muted">{formatNumber(o.size)}</Td>
            <Td align="right">
              <div className="ml-auto w-20">
                <div className="mb-1 text-[11px] text-muted-2 tabular-nums">
                  {Math.round((o.filled / o.size) * 100)}%
                </div>
                <ProgressBar value={o.filled} max={o.size} />
              </div>
            </Td>
            <Td align="center">
              <OrderStatusBadge status={o.status} />
            </Td>
            <Td align="right" className="text-muted-2">{formatRelativeTime(o.createdAt)}</Td>
            <Td align="right">
              <button
                type="button"
                onClick={() => {
                  cancelOrder(o.id)
                  addToast({ variant: 'default', title: 'Order cancelled' })
                }}
                title="Cancel order"
                className="grid h-7 w-7 place-items-center rounded-md text-muted-2 transition-colors hover:bg-loss/10 hover:text-loss"
              >
                <X size={15} />
              </button>
            </Td>
          </tr>
        ))}
      </tbody>
    </TableScroll>
  )
}
