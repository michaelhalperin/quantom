import { useBotStore } from '@/store/useBotStore'
import { PageHeader } from '@/components/layout/PageHeader'
import { StatTile } from '@/components/dashboard/widgets'
import { StrategyCard } from '@/components/strategies/StrategyCard'
import { mean } from '@/lib/utils'
import { formatCompact, formatSignedCurrency, pnlColor } from '@/lib/format'

export function StrategiesPage() {
  const strategies = useBotStore((s) => s.strategies)

  const allocated = strategies.reduce((s, x) => s + x.allocation, 0)
  const pnl = strategies.reduce((s, x) => s + x.pnl, 0)
  const running = strategies.filter((s) => s.status === 'running').length
  const trades = strategies.reduce((s, x) => s + x.trades, 0)
  const avgSharpe = mean(strategies.map((s) => s.sharpe))

  return (
    <div>
      <PageHeader
        title="Strategies"
        description="Configure, monitor and control every trading strategy running on your bot."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Strategies" value={strategies.length} sub={`${running} running`} />
        <StatTile label="Allocated" value={formatCompact(allocated, true)} />
        <StatTile label="Combined P&L" value={formatSignedCurrency(pnl, 0)} valueClass={pnlColor(pnl)} />
        <StatTile label="Total trades" value={formatCompact(trades)} />
        <StatTile label="Avg Sharpe" value={avgSharpe.toFixed(2)} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {strategies.map((s) => (
          <StrategyCard key={s.id} strategy={s} />
        ))}
      </div>
    </div>
  )
}
