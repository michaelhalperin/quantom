import { useState } from 'react'
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Info,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react'
import { useBotStore } from '@/store/useBotStore'
import { useUIStore } from '@/store/useUIStore'
import type { AlertSeverity } from '@/types'
import { PageHeader } from '@/components/layout/PageHeader'
import { SectionCard, StatTile } from '@/components/dashboard/widgets'
import { BarList } from '@/components/charts'
import { Badge, Button, ProgressBar, Slider, Switch } from '@/components/ui'
import { categoryColor } from '@/lib/colors'
import { cn } from '@/lib/utils'
import {
  formatCompact,
  formatPercent,
  formatRelativeTime,
  formatSignedCurrency,
  pnlColor,
} from '@/lib/format'

const severityMap: Record<AlertSeverity, { icon: typeof Info; cls: string }> = {
  critical: { icon: ShieldAlert, cls: 'text-loss bg-loss/10' },
  warning: { icon: AlertTriangle, cls: 'text-warning bg-warning/10' },
  info: { icon: Info, cls: 'text-primary bg-primary/10' },
}

export function RiskPage() {
  const alerts = useBotStore((s) => s.alerts)
  const riskLimits = useBotStore((s) => s.riskLimits)
  const categoryExposure = useBotStore((s) => s.categoryExposure)
  const positions = useBotStore((s) => s.positions)
  const portfolio = useBotStore((s) => s.portfolio)
  const acknowledge = useBotStore((s) => s.acknowledgeAlert)
  const dismiss = useBotStore((s) => s.dismissAlert)
  const online = useBotStore((s) => s.botStatus.online)
  const toggleOnline = useBotStore((s) => s.toggleBotOnline)
  const addToast = useUIStore((s) => s.addToast)

  const [autoKill, setAutoKill] = useState(true)
  const [dayLossLimit, setDayLossLimit] = useState(5)
  const [maxExposure, setMaxExposure] = useState(80)

  const breach = riskLimits.some((l) => l.status === 'breach')
  const warn = riskLimits.some((l) => l.status === 'warning') || alerts.some((a) => !a.acknowledged)
  const overall = breach ? 'breach' : warn ? 'warning' : 'ok'
  const largest = Math.max(...positions.map((p) => p.value), 0)

  return (
    <div>
      <PageHeader
        title="Risk"
        description="Exposure limits, alerts and the controls that keep the bot inside its mandate."
        actions={
          <Badge variant={overall === 'ok' ? 'success' : overall === 'warning' ? 'warning' : 'danger'} dot>
            {overall === 'ok' ? 'All systems nominal' : overall === 'warning' ? 'Attention needed' : 'Limit breached'}
          </Badge>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Gross exposure" value={formatPercent(portfolio.exposure, 1)} sub="of equity" />
        <StatTile label="Largest position" value={formatCompact(largest, true)} sub={`${formatPercent(largest / portfolio.equity, 1)} of equity`} />
        <StatTile
          label="Day P&L buffer"
          value={formatSignedCurrency(portfolio.dayPnl, 0)}
          valueClass={pnlColor(portfolio.dayPnl)}
          sub={`limit ${dayLossLimit}%`}
        />
        <StatTile label="Open alerts" value={alerts.filter((a) => !a.acknowledged).length} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Alerts */}
        <SectionCard className="lg:col-span-2" title="Active alerts" bodyClassName="p-2.5">
          {alerts.length === 0 ? (
            <div className="flex items-center gap-2 px-2 py-6 text-sm text-muted">
              <CheckCircle2 size={16} className="text-profit" /> No active alerts.
            </div>
          ) : (
            <div className="space-y-1.5">
              {alerts.map((a) => {
                const m = severityMap[a.severity]
                const Icon = m.icon
                return (
                  <div
                    key={a.id}
                    className={cn(
                      'flex items-start gap-3 rounded-xl border p-3',
                      a.acknowledged ? 'border-border bg-surface-2/30 opacity-70' : 'border-border bg-surface-2/50',
                    )}
                  >
                    <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg', m.cls)}>
                      <Icon size={15} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-medium text-foreground">{a.title}</p>
                        <Badge variant={a.severity === 'critical' ? 'danger' : a.severity === 'warning' ? 'warning' : 'info'}>
                          {a.severity}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-[12px] text-muted">{a.message}</p>
                      <p className="mt-1 text-[11px] text-muted-2">{formatRelativeTime(a.timestamp)}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {!a.acknowledged && (
                        <Button size="sm" variant="ghost" onClick={() => acknowledge(a.id)}>
                          Ack
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => dismiss(a.id)}>
                        Dismiss
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </SectionCard>

        {/* Controls */}
        <SectionCard title="Controls">
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[13px] font-medium text-foreground">Auto kill-switch</div>
                <div className="text-[11px] text-muted-2">Halt trading on limit breach</div>
              </div>
              <Switch checked={autoKill} onCheckedChange={setAutoKill} />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[13px] font-medium text-foreground">Daily loss limit</span>
                <span className="text-xs font-semibold text-foreground tabular-nums">{dayLossLimit}%</span>
              </div>
              <Slider value={dayLossLimit} min={1} max={20} step={1} onChange={setDayLossLimit} />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[13px] font-medium text-foreground">Max gross exposure</span>
                <span className="text-xs font-semibold text-foreground tabular-nums">{maxExposure}%</span>
              </div>
              <Slider value={maxExposure} min={10} max={100} step={5} onChange={setMaxExposure} />
            </div>

            <Button
              variant={online ? 'danger' : 'success'}
              className="w-full"
              onClick={() => {
                toggleOnline()
                addToast({
                  variant: online ? 'error' : 'success',
                  title: online ? 'Trading halted' : 'Trading resumed',
                })
              }}
            >
              {online ? <Ban size={15} /> : <ShieldCheck size={15} />}
              {online ? 'Halt all trading' : 'Resume trading'}
            </Button>
          </div>
        </SectionCard>
      </div>

      {/* Limits grid */}
      <div className="mt-4">
        <SectionCard title="Exposure limits">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {riskLimits.map((l) => {
              const pct = Math.min(100, (l.current / l.limit) * 100)
              const barCls =
                l.status === 'breach' ? 'bg-loss' : l.status === 'warning' ? 'bg-warning' : 'bg-profit'
              return (
                <div key={l.key} className="rounded-xl border border-border bg-surface-2/30 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-[13px] font-medium text-foreground">{l.label}</div>
                      <div className="mt-0.5 text-[11px] text-muted-2">{l.description}</div>
                    </div>
                    <Badge variant={l.status === 'ok' ? 'success' : l.status === 'warning' ? 'warning' : 'danger'}>
                      {l.status}
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-end justify-between">
                    <span className="text-lg font-semibold text-foreground tabular-nums">
                      {l.current}
                      {l.unit}
                    </span>
                    <span className="text-[11px] text-muted-2 tabular-nums">
                      limit {l.limit}
                      {l.unit}
                    </span>
                  </div>
                  <ProgressBar value={pct} className="mt-2" barClassName={barCls} />
                </div>
              )
            })}
          </div>
        </SectionCard>
      </div>

      {/* Category exposure */}
      <div className="mt-4">
        <SectionCard title="Exposure by category">
          <BarList
            data={categoryExposure.map((c) => ({
              name: c.category,
              value: Math.round(c.value),
              color: `color-mix(in srgb, ${categoryColor(c.category)} 28%, transparent)`,
              badge: (
                <span className={cn('text-[11px] tabular-nums', pnlColor(c.pnl))}>
                  {formatSignedCurrency(c.pnl, 0)}
                </span>
              ),
            }))}
            valueFormatter={(v) => formatCompact(v, true)}
          />
        </SectionCard>
      </div>
    </div>
  )
}
