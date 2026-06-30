import {
  LayoutDashboard,
  Wallet,
  Store,
  ScrollText,
  Receipt,
  Cpu,
  BarChart3,
  ShieldAlert,
  Activity,
  Settings,
  type LucideIcon,
} from 'lucide-react'

export type BadgeKey = 'positions' | 'orders' | 'alerts'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  badge?: BadgeKey
  group: 'Trade' | 'Insights' | 'System'
}

export const NAV: NavItem[] = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true, group: 'Trade' },
  { to: '/positions', label: 'Positions', icon: Wallet, badge: 'positions', group: 'Trade' },
  { to: '/markets', label: 'Markets', icon: Store, group: 'Trade' },
  { to: '/orders', label: 'Orders', icon: ScrollText, badge: 'orders', group: 'Trade' },
  { to: '/trades', label: 'Trade History', icon: Receipt, group: 'Trade' },
  { to: '/strategies', label: 'Strategies', icon: Cpu, group: 'Insights' },
  { to: '/analytics', label: 'Analytics', icon: BarChart3, group: 'Insights' },
  { to: '/risk', label: 'Risk', icon: ShieldAlert, badge: 'alerts', group: 'Insights' },
  { to: '/activity', label: 'Activity', icon: Activity, group: 'System' },
  { to: '/settings', label: 'Settings', icon: Settings, group: 'System' },
]
