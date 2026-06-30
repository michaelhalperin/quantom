import { useMemo } from 'react'
import { useBotStore } from '@/store/useBotStore'
import type { MarketCategory } from '@/types'
import { PageHeader } from '@/components/layout/PageHeader'
import { SectionCard, StatTile } from '@/components/dashboard/widgets'
import { PnLChart, DrawdownChart, Donut, BarList, Heatmap } from '@/components/charts'
import { categoryColor } from '@/lib/colors'
import {
  formatCurrency,
  formatPctPoints,
  formatPercent,
  formatSignedCurrency,
  pnlColor,
} from '@/lib/format'

export function AnalyticsPage() {
  const performance = useBotStore((s) => s.performance)
  const equityCurve = useBotStore((s) => s.equityCurve)
  const trades = useBotStore((s) => s.trades)
  const heatmap = useBotStore((s) => s.heatmap)

  const dailyPnl = useMemo(
    () =>
      equityCurve.map((p, i) => ({
        t: p.t,
        value: i === 0 ? 0 : Math.round(p.equity - equityCurve[i - 1].equity),
      })),
    [equityCurve],
  )

  const categoryPnl = useMemo(() => {
    const map = new Map<MarketCategory, number>()
    for (const t of trades) {
      if (t.pnl === null) continue
      map.set(t.category, (map.get(t.category) ?? 0) + t.pnl)
    }
    return [...map.entries()]
      .map(([category, pnl]) => ({
        name: category,
        value: Math.round(pnl),
        color: categoryColor(category),
      }))
      .sort((a, b) => b.value - a.value)
  }, [trades])

  const winLoss = [
    { name: 'Wins', value: performance.wins, color: 'var(--profit)' },
    { name: 'Losses', value: performance.losses, color: 'var(--loss)' },
  ]

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Deep performance analysis across the bot's entire trading history."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Sharpe" value={performance.sharpe.toFixed(2)} />
        <StatTile label="Sortino" value={performance.sortino.toFixed(2)} />
        <StatTile label="Profit factor" value={performance.profitFactor.toFixed(2)} />
        <StatTile
          label="Expectancy"
          value={formatSignedCurrency(performance.expectancy, 0)}
          valueClass={pnlColor(performance.expectancy)}
        />
        <StatTile
          label="Max drawdown"
          value={formatPctPoints(performance.maxDrawdownPct)}
          valueClass="text-loss"
        />
        <StatTile
          label="ROI"
          value={formatPctPoints(performance.roi)}
          valueClass={pnlColor(performance.roi)}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <SectionCard className="lg:col-span-2" title="Daily P&L" subtitle="Net realized + mark-to-market per day" bodyClassName="pt-3">
          <PnLChart data={dailyPnl} />
        </SectionCard>

        <SectionCard title="Win / loss" subtitle={`${performance.totalTrades} closed trades`}>
          <div className="flex flex-col items-center gap-4">
            <Donut
              data={winLoss}
              centerValue={formatPercent(performance.winRate, 0)}
              centerLabel="Win rate"
            />
            <div className="grid w-full grid-cols-2 gap-2">
              <StatTile label="Avg win" value={formatCurrency(performance.avgWin, 0)} valueClass="text-profit" />
              <StatTile label="Avg loss" value={formatCurrency(performance.avgLoss, 0)} valueClass="text-loss" />
              <StatTile label="Best trade" value={formatSignedCurrency(performance.bestTrade, 0)} valueClass="text-profit" />
              <StatTile label="Worst trade" value={formatSignedCurrency(performance.worstTrade, 0)} valueClass="text-loss" />
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <SectionCard className="lg:col-span-2" title="Drawdown" subtitle="Peak-to-trough decline over time" bodyClassName="pt-3">
          <DrawdownChart data={equityCurve} />
        </SectionCard>

        <SectionCard title="P&L by category" subtitle="Realized, all-time">
          {categoryPnl.length ? (
            <BarList data={categoryPnl} valueFormatter={(v) => formatSignedCurrency(v, 0)} />
          ) : (
            <p className="text-sm text-muted">No realized trades yet.</p>
          )}
        </SectionCard>
      </div>

      <div className="mt-4">
        <SectionCard
          title="P&L by day & hour"
          subtitle="When the bot makes money (UTC)"
        >
          <Heatmap data={heatmap} />
        </SectionCard>
      </div>
    </div>
  )
}
