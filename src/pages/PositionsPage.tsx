import { useMemo, useState } from 'react'
import { useBotStore } from '@/store/useBotStore'
import { PageHeader } from '@/components/layout/PageHeader'
import { SectionCard, StatTile } from '@/components/dashboard/widgets'
import { PositionsTable } from '@/components/positions/PositionsTable'
import { SegmentedControl, Select } from '@/components/ui'
import {
  formatCurrency,
  formatPercent,
  formatSignedCurrency,
  pnlColor,
} from '@/lib/format'

export function PositionsPage() {
  const positions = useBotStore((s) => s.positions)
  const strategies = useBotStore((s) => s.strategies)
  const portfolio = useBotStore((s) => s.portfolio)

  const [side, setSide] = useState<'all' | 'YES' | 'NO'>('all')
  const [strat, setStrat] = useState('all')

  const filtered = useMemo(
    () =>
      positions.filter(
        (p) => (side === 'all' || p.side === side) && (strat === 'all' || p.strategyId === strat),
      ),
    [positions, side, strat],
  )

  const value = filtered.reduce((s, p) => s + p.value, 0)
  const unreal = filtered.reduce((s, p) => s + p.unrealizedPnl, 0)
  const cost = filtered.reduce((s, p) => s + p.costBasis, 0)
  const realized = positions.reduce((s, p) => s + p.realizedPnl, 0)

  return (
    <div>
      <PageHeader
        title="Positions"
        description="Every open position the bot holds, marked to live market prices."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Open" value={positions.length} sub={`${filtered.length} shown`} />
        <StatTile label="Market value" value={formatCurrency(value, 0)} />
        <StatTile
          label="Unrealized P&L"
          value={formatSignedCurrency(unreal, 0)}
          valueClass={pnlColor(unreal)}
          sub={cost ? formatPercent(unreal / cost, 2, true) : undefined}
        />
        <StatTile
          label="Realized P&L"
          value={formatSignedCurrency(realized, 0)}
          valueClass={pnlColor(realized)}
        />
        <StatTile label="Exposure" value={formatPercent(portfolio.exposure, 1)} sub="of equity" />
      </div>

      <div className="mt-4">
        <SectionCard
          title="Open positions"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <SegmentedControl
                size="sm"
                value={side}
                onChange={setSide}
                options={[
                  { label: 'All', value: 'all' },
                  { label: 'YES', value: 'YES' },
                  { label: 'NO', value: 'NO' },
                ]}
              />
              <Select value={strat} onChange={(e) => setStrat(e.target.value)} className="h-8 text-xs">
                <option value="all">All strategies</option>
                {strategies.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
          }
          bodyClassName="p-0"
        >
          <PositionsTable positions={filtered} />
        </SectionCard>
      </div>
    </div>
  )
}
