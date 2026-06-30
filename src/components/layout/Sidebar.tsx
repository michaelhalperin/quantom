import { NavLink } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { PanelLeftClose, PanelLeftOpen, Power, X } from 'lucide-react'
import { NAV, type BadgeKey } from '@/lib/nav'
import { useBotStore } from '@/store/useBotStore'
import { useUIStore } from '@/store/useUIStore'
import { cn } from '@/lib/utils'
import { formatCompact } from '@/lib/format'
import { Logo, StatusDot } from '@/components/common/misc'

const GROUPS = ['Trade', 'Insights', 'System'] as const

function useBadgeCounts(): Record<BadgeKey, number> {
  const positions = useBotStore((s) => s.positions.length)
  const orders = useBotStore((s) => s.orders.length)
  const alerts = useBotStore((s) => s.alerts.filter((a) => !a.acknowledged).length)
  return { positions, orders, alerts }
}

function SidebarContent({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean
  onNavigate?: () => void
}) {
  const badges = useBadgeCounts()
  const online = useBotStore((s) => s.botStatus.online)
  const mode = useBotStore((s) => s.botStatus.mode)
  const equity = useBotStore((s) => s.portfolio.equity)
  const toggleOnline = useBotStore((s) => s.toggleBotOnline)

  return (
    <div className="flex h-full flex-col">
      <div className={cn('flex h-16 items-center px-4', collapsed && 'justify-center px-0')}>
        <Logo collapsed={collapsed} />
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-2 no-scrollbar">
        {GROUPS.map((group) => {
          const items = NAV.filter((n) => n.group === group)
          return (
            <div key={group} className="space-y-1">
              {!collapsed && (
                <div className="px-2.5 pb-1 text-[10px] font-semibold tracking-wider text-muted-2 uppercase">
                  {group}
                </div>
              )}
              {items.map((item) => {
                const Icon = item.icon
                const count = item.badge ? badges[item.badge] : 0
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={onNavigate}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      cn(
                        'group relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors',
                        collapsed && 'justify-center px-0',
                        isActive
                          ? 'bg-primary/12 text-primary'
                          : 'text-muted hover:bg-surface-2 hover:text-foreground',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && !collapsed && (
                          <span className="absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-primary" />
                        )}
                        <Icon size={18} className="shrink-0" />
                        {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                        {!collapsed && count > 0 && (
                          <span
                            className={cn(
                              'rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
                              item.badge === 'alerts'
                                ? 'bg-loss/15 text-loss'
                                : 'bg-surface-3 text-muted',
                            )}
                          >
                            {count}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                )
              })}
            </div>
          )
        })}
      </nav>

      <div className="border-t border-border p-3">
        {collapsed ? (
          <button
            type="button"
            onClick={toggleOnline}
            title={online ? 'Bot running — click to pause' : 'Bot paused — click to resume'}
            className={cn(
              'grid h-9 w-full place-items-center rounded-lg transition-colors',
              online ? 'text-profit hover:bg-profit/10' : 'text-loss hover:bg-loss/10',
            )}
          >
            <Power size={17} />
          </button>
        ) : (
          <div className="rounded-xl border border-border bg-surface-2/60 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <StatusDot status={online} />
                <span className="text-xs font-medium text-foreground">
                  {online ? 'Bot online' : 'Bot paused'}
                </span>
              </div>
              <span className="rounded-md bg-surface-3 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-muted uppercase">
                {mode}
              </span>
            </div>
            <div className="mt-2.5 flex items-end justify-between">
              <div>
                <div className="text-[10px] text-muted-2">Equity</div>
                <div className="text-sm font-semibold text-foreground tabular-nums">
                  {formatCompact(equity, true)}
                </div>
              </div>
              <button
                type="button"
                onClick={toggleOnline}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                  online
                    ? 'bg-loss/12 text-loss hover:bg-loss/20'
                    : 'bg-profit/12 text-profit hover:bg-profit/20',
                )}
              >
                <Power size={13} />
                {online ? 'Pause' : 'Resume'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function Sidebar() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed)
  const toggle = useUIStore((s) => s.toggleSidebar)
  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-screen shrink-0 border-r border-border bg-surface/40 backdrop-blur-xl transition-[width] duration-200 lg:block',
        collapsed ? 'w-[76px]' : 'w-60',
      )}
    >
      <SidebarContent collapsed={collapsed} />
      <button
        type="button"
        onClick={toggle}
        aria-label="Toggle sidebar"
        className="absolute -right-3 top-20 grid h-6 w-6 place-items-center rounded-full border border-border bg-surface text-muted-2 shadow-md transition-colors hover:text-foreground"
      >
        {collapsed ? <PanelLeftOpen size={13} /> : <PanelLeftClose size={13} />}
      </button>
    </aside>
  )
}

export function MobileSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="absolute inset-y-0 left-0 w-64 border-r border-border bg-surface"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'tween', duration: 0.22, ease: 'easeOut' }}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close menu"
              className="absolute top-4 right-3 z-10 grid h-8 w-8 place-items-center rounded-lg text-muted-2 hover:bg-surface-2 hover:text-foreground"
            >
              <X size={17} />
            </button>
            <SidebarContent collapsed={false} onNavigate={onClose} />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
