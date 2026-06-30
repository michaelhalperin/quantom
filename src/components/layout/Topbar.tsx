import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Check, Copy, Fuel, Menu, Power, Search, Wifi } from 'lucide-react'
import { useBotStore } from '@/store/useBotStore'
import { useUIStore } from '@/store/useUIStore'
import { cn } from '@/lib/utils'
import {
  formatCompact,
  formatRelativeTime,
  formatSignedCurrency,
  pnlColor,
  truncateAddress,
} from '@/lib/format'
import {
  Badge,
  Dropdown,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
  Kbd,
} from '@/components/ui'
import { StatusDot, ThemeToggle } from '@/components/common/misc'

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const setCommandOpen = useUIStore((s) => s.setCommandOpen)
  const portfolio = useBotStore((s) => s.portfolio)
  const bot = useBotStore((s) => s.botStatus)
  const alerts = useBotStore((s) => s.alerts)
  const activity = useBotStore((s) => s.activity)
  const toggleOnline = useBotStore((s) => s.toggleBotOnline)
  const unacked = alerts.filter((a) => !a.acknowledged)

  return (
    <header className="glass sticky top-0 z-40 border-b border-border">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        <button
          type="button"
          onClick={onMenu}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground lg:hidden"
          aria-label="Open menu"
        >
          <Menu size={19} />
        </button>

        {/* Search */}
        <button
          type="button"
          onClick={() => setCommandOpen(true)}
          className="group flex h-9 flex-1 items-center gap-2.5 rounded-lg border border-border bg-surface-2/60 px-3 text-muted-2 transition-colors hover:border-border-strong hover:text-muted sm:max-w-xs"
        >
          <Search size={15} />
          <span className="flex-1 truncate text-left text-[13px]">Search markets, strategies…</span>
          <span className="hidden items-center gap-0.5 sm:flex">
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>

        <div className="flex-1" />

        {/* Quick portfolio stats */}
        <div className="hidden items-center gap-5 xl:flex">
          <Stat label="Equity" value={formatCompact(portfolio.equity, true)} />
          <Stat
            label="Day P&L"
            value={formatSignedCurrency(portfolio.dayPnl, 0)}
            valueClass={pnlColor(portfolio.dayPnl)}
          />
          <Stat
            label="Unrealized"
            value={formatSignedCurrency(portfolio.unrealizedPnl, 0)}
            valueClass={pnlColor(portfolio.unrealizedPnl)}
          />
          <div className="h-8 w-px bg-border" />
        </div>

        {/* Connection chip */}
        <div className="hidden items-center gap-3 rounded-lg border border-border bg-surface-2/60 px-3 py-1.5 md:flex">
          <span className="flex items-center gap-1.5" title="Latency">
            <Wifi size={13} className="text-profit" />
            <span className="text-xs font-medium text-muted tabular-nums">{bot.latencyMs}ms</span>
          </span>
          <span className="flex items-center gap-1.5" title="Gas (gwei)">
            <Fuel size={13} className="text-muted-2" />
            <span className="text-xs font-medium text-muted tabular-nums">{bot.gasGwei}</span>
          </span>
        </div>

        {/* Notifications */}
        <Dropdown
          align="right"
          className="w-80"
          trigger={
            <span className="relative grid h-9 w-9 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-foreground">
              <Bell size={17} />
              {unacked.length > 0 && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-loss ring-2 ring-surface" />
              )}
            </span>
          }
        >
          <div className="flex items-center justify-between px-2.5 py-1.5">
            <span className="text-xs font-semibold text-foreground">Notifications</span>
            {unacked.length > 0 && <Badge variant="danger">{unacked.length} new</Badge>}
          </div>
          <DropdownSeparator />
          <div className="max-h-80 overflow-y-auto">
            {[...unacked, ...activity.slice(0, 6)].slice(0, 8).map((n, i) => {
              const isAlert = 'severity' in n
              return (
                <div
                  key={i}
                  className="flex gap-2.5 rounded-lg px-2.5 py-2 hover:bg-surface-2"
                >
                  <span
                    className={cn(
                      'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full',
                      isAlert ? 'bg-loss' : 'bg-primary',
                    )}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] text-foreground">
                      {isAlert ? n.title : n.message}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-2">
                      {formatRelativeTime(n.timestamp)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
          <DropdownSeparator />
          <Link
            to="/activity"
            className="block rounded-lg px-2.5 py-1.5 text-center text-xs font-medium text-primary hover:bg-surface-2"
          >
            View all activity
          </Link>
        </Dropdown>

        <ThemeToggle />

        {/* Account */}
        <Dropdown
          align="right"
          trigger={
            <span className="flex items-center gap-2 rounded-lg border border-border bg-surface-2/60 py-1 pr-2 pl-1 transition-colors hover:border-border-strong">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-primary to-accent text-[11px] font-bold text-white">
                Ξ
              </span>
              <span className="hidden text-left sm:block">
                <span className="block text-[11px] leading-tight font-medium text-foreground tabular-nums">
                  {truncateAddress(bot.wallet)}
                </span>
                <span className="block text-[10px] leading-tight text-muted-2">{bot.network}</span>
              </span>
            </span>
          }
        >
          <DropdownLabel>Wallet</DropdownLabel>
          <CopyAddress address={bot.wallet} />
          <DropdownSeparator />
          <DropdownItem icon={<Power size={15} />} onClick={toggleOnline}>
            {bot.online ? 'Pause bot' : 'Resume bot'}
          </DropdownItem>
          <Link
            to="/settings"
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] text-foreground transition-colors hover:bg-surface-2"
          >
            Settings
          </Link>
          <DropdownSeparator />
          <div className="flex items-center justify-between px-2.5 py-1.5">
            <span className="flex items-center gap-1.5 text-[11px] text-muted">
              <StatusDot status={bot.connection} />
              {bot.connection}
            </span>
            <span className="text-[11px] text-muted-2">v{bot.version}</span>
          </div>
        </Dropdown>
      </div>
    </header>
  )
}

function Stat({
  label,
  value,
  valueClass,
}: {
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div className="leading-tight">
      <div className="text-[10px] font-medium tracking-wide text-muted-2 uppercase">{label}</div>
      <div className={cn('text-sm font-semibold text-foreground tabular-nums', valueClass)}>
        {value}
      </div>
    </div>
  )
}

function CopyAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(address)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[12px] text-foreground hover:bg-surface-2"
    >
      <span className="truncate tabular-nums">{truncateAddress(address, 10, 8)}</span>
      {copied ? <Check size={14} className="text-profit" /> : <Copy size={14} className="text-muted-2" />}
    </button>
  )
}
