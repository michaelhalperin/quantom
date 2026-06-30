import { useBotStore } from '@/store/useBotStore'
import { useUIStore } from '@/store/useUIStore'
import { PageHeader } from '@/components/layout/PageHeader'
import { SectionCard, StatTile } from '@/components/dashboard/widgets'
import { OrdersTable } from '@/components/orders/OrdersTable'
import { Button } from '@/components/ui'
import { formatCurrency } from '@/lib/format'

export function OrdersPage() {
  const orders = useBotStore((s) => s.orders)
  const cancelOrder = useBotStore((s) => s.cancelOrder)
  const addToast = useUIStore((s) => s.addToast)

  const restingValue = orders.reduce((s, o) => s + (o.size - o.filled) * o.price, 0)
  const buys = orders.filter((o) => o.side === 'buy').length
  const partials = orders.filter((o) => o.status === 'partial').length

  const cancelAll = () => {
    orders.forEach((o) => cancelOrder(o.id))
    addToast({ variant: 'default', title: `Cancelled ${orders.length} orders` })
  }

  return (
    <div>
      <PageHeader
        title="Orders"
        description="Resting and partially filled orders placed by the bot and manually."
        actions={
          orders.length > 0 && (
            <Button variant="danger" size="sm" onClick={cancelAll}>
              Cancel all
            </Button>
          )
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Open orders" value={orders.length} />
        <StatTile label="Resting value" value={formatCurrency(restingValue, 0)} />
        <StatTile label="Buy / Sell" value={`${buys} / ${orders.length - buys}`} />
        <StatTile label="Partially filled" value={partials} />
      </div>

      <div className="mt-4">
        <SectionCard title="Working orders" bodyClassName="p-0">
          <OrdersTable orders={orders} />
        </SectionCard>
      </div>
    </div>
  )
}
