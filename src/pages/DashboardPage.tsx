import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity as ActivityIcon,
  ArrowUpRight,
  Layers,
  Target,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { useBotStore } from '@/store/useBotStore'
import { PageHeader } from '@/components/layout/PageHeader'
import { KpiCard, SectionCard } from '@/components/dashboard/widgets'
import { EquityChart, Donut, BarList } from '@/components/charts'
import { ActivityFeed } from '@/components/activity/ActivityFeed'
import { PositionsTable } from '@/components/positions/PositionsTable'
import { Badge, Button, ProgressBar, SegmentedControl } from '@/components/ui'
import { categoryColor } from '@/lib/colors'
import { cn } from '@/lib/utils'
import {
  formatCompact,
  formatCurrency,
  formatPctPoints,
  formatPercent,
  formatSignedCurrency,
  pnlColor,
} from '@/lib/format'

const TF = { '7D': 7, '30D': 30, '90D': 90 } as const
type Tf = keyof typeof TF

export function DashboardPage() {
  const portfolio = useBotStore((s) => s.portfolio)
  const performance = useBotStore((s) => s.performance)
  const equityCurve = useBotStore((s) => s.equityCurve)
  const positions = useBotStore((s) => s.positions)
  const activity = useBotStore((s) => s.activity)
  const strategies = useBotStore((s) => s.strategies)
  const categoryExposure = useBotStore((s) => s.categoryExposure)
  const riskLimits = useBotStore((s) => s.riskLimits)
  const markets = useBotStore((s) => s.markets)

  const [tf, setTf] = useState<Tf>('30D')
  const equitySlice = equityCurve.slice(-TF[tf])
  const equitySpark = equityCurve.slice(-30).map((e) => e.equity)

  const topPositions = [...positions].sort((a, b) => b.value - a.value).slice(0, 6)
  const topMovers = [...markets]
    .sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h))
    .slice(0, 6)
  const donutData = categoryExposure.map((c) => ({
    name: c.category,
    value: c.value,
    color: categoryColor(c.category),
  }))
  const strategyBars = [...strategies]
    .sort((a, b) => b.pnl - a.pnl)
    .map((s) => ({
      name: s.name,
      value: Math.round(s.pnl),
      color: s.pnl >= 0 ? 'color-mix(in srgb, var(--profit) 22%, transparent)' : 'color-mix(in srgb, var(--loss) 22%, transparent)',
    }))

  return (
    <div>
      <PageHeader
        title="Overview"
        description="Live snapshot of your Polymarket bot — equity, exposure, performance and activity."
        actions={
          <Link to="/markets">
            <Button variant="secondary" size="sm">
              <ArrowUpRight size={15} />
              Browse markets
            </Button>
          </Link>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          label="Equity"
          value={portfolio.equity}
          format={(n) => formatCurrency(n, 0)}
          icon={<Wallet size={15} />}
          delta={portfolio.dayPnl}
          deltaText={`${formatPctPoints(portfolio.dayPnlPct)} today`}
          spark={equitySpark}
        />
        <KpiCard
          label="Total P&L"
          value={portfolio.totalPnl}
          format={(n) => formatSignedCurrency(n, 0)}
          icon={<TrendingUp size={15} />}
          accent={portfolio.totalPnl >= 0 ? 'profit' : 'loss'}
          valueColor={pnlColor(portfolio.totalPnl)}
          delta={portfolio.totalPnl}
          deltaText={`${formatPctPoints(portfolio.totalPnlPct)} ROI`}
        />
        <KpiCard
          label="Day P&L"
          value={portfolio.dayPnl}
          format={(n) => formatSignedCurrency(n, 0)}
          icon={<ActivityIcon size={15} />}
          accent={portfolio.dayPnl >= 0 ? 'profit' : 'loss'}
          valueColor={pnlColor(portfolio.dayPnl)}
          delta={portfolio.dayPnl}
          deltaText={formatPctPoints(portfolio.dayPnlPct)}
        />
        <KpiCard
          label="Deployed"
          value={portfolio.positionsValue}
          format={(n) => formatCurrency(n, 0)}
          icon={<Layers size={15} />}
          accent="accent"
          deltaText={`${formatPercent(portfolio.exposure, 0)} of equity`}
        />
        <KpiCard
          label="Win rate"
          value={performance.winRate * 100}
          format={(n) => `${n.toFixed(1)}%`}
          icon={<Target size={15} />}
          accent="warning"
          deltaText={`PF ${performance.profitFactor.toFixed(2)} · ${performance.totalTrades} trades`}
        />
      </div>

      {/* Equity + allocation */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <SectionCard
          className="lg:col-span-2"
          title="Portfolio equity"
          subtitle={`${formatCurrency(portfolio.equity)} · ${formatPctPoints(portfolio.totalPnlPct)} all-time`}
          action={
            <SegmentedControl
              size="sm"
              value={tf}
              onChange={setTf}
              options={[
                { label: '7D', value: '7D' },
                { label: '30D', value: '30D' },
                { label: '90D', value: '90D' },
              ]}
            />
          }
          bodyClassName="pt-3"
        >
          <EquityChart data={equitySlice} />
        </SectionCard>

        <SectionCard title="Allocation" subtitle="By market category">
          <div className="flex flex-col items-center gap-4">
            <Donut
              data={donutData}
              centerValue={formatCompact(portfolio.positionsValue, true)}
              centerLabel="Deployed"
            />
            <div className="w-full space-y-1.5">
              {categoryExposure.slice(0, 6).map((c) => (
                <div key={c.category} className="flex items-center justify-between text-[12px]">
                  <span className="flex items-center gap-2 text-muted">
                    <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: categoryColor(c.category) }} />
                    {c.category}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-medium text-foreground tabular-nums">{formatCompact(c.value, true)}</span>
                    <span className={cn('text-[11px] tabular-nums', pnlColor(c.pnl))}>
                      {formatSignedCurrency(c.pnl, 0)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Positions + activity */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <SectionCard
          className="lg:col-span-2"
          title="Top open positions"
          subtitle={`${positions.length} active`}
          action={
            <Link to="/positions" className="text-xs font-medium text-primary hover:underline">
              View all
            </Link>
          }
          bodyClassName="p-0"
        >
          <PositionsTable positions={topPositions} />
        </SectionCard>

        <SectionCard
          title="Live activity"
          action={
            <Link to="/activity" className="text-xs font-medium text-primary hover:underline">
              View all
            </Link>
          }
          bodyClassName="p-2.5"
        >
          <ActivityFeed events={activity} limit={7} />
        </SectionCard>
      </div>

      {/* Strategy P&L + risk + movers */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <SectionCard
          title="Strategy P&L"
          action={
            <Link to="/strategies" className="text-xs font-medium text-primary hover:underline">
              Manage
            </Link>
          }
        >
          <BarList
            data={strategyBars}
            valueFormatter={(v) => formatSignedCurrency(v, 0)}
          />
        </SectionCard>

        <SectionCard
          title="Risk limits"
          action={
            <Link to="/risk" className="text-xs font-medium text-primary hover:underline">
              Details
            </Link>
          }
        >
          <div className="space-y-3.5">
            {riskLimits.slice(0, 5).map((l) => {
              const pct = Math.min(100, (l.current / l.limit) * 100)
              const color =
                l.status === 'breach' ? 'bg-loss' : l.status === 'warning' ? 'bg-warning' : 'bg-profit'
              return (
                <div key={l.key}>
                  <div className="mb-1 flex items-center justify-between text-[12px]">
                    <span className="text-muted">{l.label}</span>
                    <span className="font-medium text-foreground tabular-nums">
                      {l.current}
                      {l.unit} / {l.limit}
                      {l.unit}
                    </span>
                  </div>
                  <ProgressBar value={pct} barClassName={color} />
                </div>
              )
            })}
          </div>
        </SectionCard>

        <SectionCard title="Top movers" subtitle="Largest 24h moves">
          <div className="space-y-1">
            {topMovers.map((m) => (
              <Link
                key={m.id}
                to={`/markets/${m.id}`}
                className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-2/50"
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-surface-2 text-sm">
                  {m.icon}
                </span>
                <span className="line-clamp-1 flex-1 text-[12px] text-foreground">{m.question}</span>
                <span className="text-[12px] font-medium text-foreground tabular-nums">
                  {(m.yesPrice * 100).toFixed(0)}¢
                </span>
                <Badge variant={m.change24h >= 0 ? 'success' : 'danger'}>
                  {formatPctPoints(m.change24h)}
                </Badge>
              </Link>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
