import { useState } from 'react'
import { Pause, Play, Settings2, Square } from 'lucide-react'
import type { Strategy, StrategyKind } from '@/types'
import { useBotStore } from '@/store/useBotStore'
import { useUIStore } from '@/store/useUIStore'
import { Badge, Button, Card, Modal, Slider, Sparkline } from '@/components/ui'
import { StrategyStatusBadge } from '@/components/common/badges'
import {
  formatCompact,
  formatPctPoints,
  formatPercent,
  formatRelativeTime,
  formatSignedCurrency,
  pnlColor,
} from '@/lib/format'
import { cn } from '@/lib/utils'

const kindLabel: Record<StrategyKind, string> = {
  'market-making': 'Market Making',
  momentum: 'Momentum',
  'mean-reversion': 'Mean Reversion',
  arbitrage: 'Arbitrage',
  'news-sentiment': 'News Sentiment',
  'copy-trading': 'Copy Trading',
}

export function StrategyCard({ strategy }: { strategy: Strategy }) {
  const toggleStrategy = useBotStore((s) => s.toggleStrategy)
  const setStatus = useBotStore((s) => s.setStrategyStatus)
  const updateParam = useBotStore((s) => s.updateStrategyParam)
  const addToast = useUIStore((s) => s.addToast)
  const [configOpen, setConfigOpen] = useState(false)

  const running = strategy.status === 'running'
  const spark = strategy.equity.map((p) => p.p)

  return (
    <Card className="flex flex-col p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-foreground">{strategy.name}</h3>
            <StrategyStatusBadge status={strategy.status} />
          </div>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="outline">{kindLabel[strategy.kind]}</Badge>
            <span className="text-[11px] text-muted-2">
              {strategy.markets} markets · signal {formatRelativeTime(strategy.lastSignal)}
            </span>
          </div>
        </div>
        <Sparkline data={spark} width={84} height={34} />
      </div>

      <p className="mt-3 line-clamp-2 text-[12px] leading-relaxed text-muted">{strategy.description}</p>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-4">
        <Metric label="P&L" value={formatSignedCurrency(strategy.pnl, 0)} valueClass={pnlColor(strategy.pnl)} />
        <Metric
          label="7d"
          value={formatSignedCurrency(strategy.pnl7d, 0)}
          valueClass={pnlColor(strategy.pnl7d)}
        />
        <Metric label="Win rate" value={formatPercent(strategy.winRate, 0)} />
        <Metric label="Sharpe" value={strategy.sharpe.toFixed(2)} />
        <Metric label="Trades" value={formatCompact(strategy.trades)} />
        <Metric label="Max DD" value={formatPctPoints(strategy.maxDrawdown)} valueClass="text-loss" />
        <Metric label="Allocated" value={formatCompact(strategy.allocation, true)} />
        <Metric label="Markets" value={String(strategy.markets)} />
      </div>

      <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
        <Button
          size="sm"
          variant={running ? 'danger' : 'success'}
          onClick={() => {
            toggleStrategy(strategy.id)
            addToast({
              variant: running ? 'warning' : 'success',
              title: running ? `${strategy.name} paused` : `${strategy.name} resumed`,
            })
          }}
        >
          {running ? <Pause size={14} /> : <Play size={14} />}
          {running ? 'Pause' : 'Resume'}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setConfigOpen(true)}>
          <Settings2 size={14} />
          Configure
        </Button>
        {strategy.status !== 'stopped' && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setStatus(strategy.id, 'stopped')
              addToast({ variant: 'default', title: `${strategy.name} stopped` })
            }}
            title="Stop strategy"
          >
            <Square size={13} />
          </Button>
        )}
      </div>

      <Modal
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        title={`Configure · ${strategy.name}`}
        description={kindLabel[strategy.kind]}
        footer={
          <Button onClick={() => setConfigOpen(false)}>Done</Button>
        }
      >
        <div className="space-y-5">
          {strategy.params.map((param) => (
            <div key={param.key}>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-[13px] font-medium text-foreground">{param.label}</label>
                <span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs font-semibold text-foreground tabular-nums">
                  {param.unit === '$' ? '$' : ''}
                  {param.value}
                  {param.unit && param.unit !== '$' ? ` ${param.unit}` : ''}
                </span>
              </div>
              <Slider
                value={param.value}
                min={param.min}
                max={param.max}
                step={param.step}
                onChange={(v) => updateParam(strategy.id, param.key, v)}
              />
              <div className="mt-1 flex justify-between text-[10px] text-muted-2 tabular-nums">
                <span>{param.min}</span>
                <span>{param.max}</span>
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </Card>
  )
}

function Metric({
  label,
  value,
  valueClass,
}: {
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div>
      <div className="text-[10px] font-medium tracking-wide text-muted-2 uppercase">{label}</div>
      <div className={cn('mt-0.5 text-[13px] font-semibold text-foreground tabular-nums', valueClass)}>
        {value}
      </div>
    </div>
  )
}
