import { lazy, useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import { useBotStore } from '@/store/useBotStore'
import { useSimulation } from '@/hooks/useSimulation'
import { AppLayout } from '@/components/layout/AppLayout'
import { CommandPalette } from '@/components/common/CommandPalette'
import { Toaster } from '@/components/common/Toaster'
import { Logo } from '@/components/common/misc'
import { Spinner } from '@/components/ui'
import { NotFoundPage } from '@/pages/NotFoundPage'

// Route-level code splitting keeps the initial bundle (and Recharts) lean.
const named = <T extends string>(p: Promise<Record<T, React.ComponentType>>, key: T) =>
  p.then((m) => ({ default: m[key] }))

const DashboardPage = lazy(() => named(import('@/pages/DashboardPage'), 'DashboardPage'))
const PositionsPage = lazy(() => named(import('@/pages/PositionsPage'), 'PositionsPage'))
const MarketsPage = lazy(() => named(import('@/pages/MarketsPage'), 'MarketsPage'))
const MarketDetailPage = lazy(() => named(import('@/pages/MarketDetailPage'), 'MarketDetailPage'))
const OrdersPage = lazy(() => named(import('@/pages/OrdersPage'), 'OrdersPage'))
const TradesPage = lazy(() => named(import('@/pages/TradesPage'), 'TradesPage'))
const StrategiesPage = lazy(() => named(import('@/pages/StrategiesPage'), 'StrategiesPage'))
const AnalyticsPage = lazy(() => named(import('@/pages/AnalyticsPage'), 'AnalyticsPage'))
const RiskPage = lazy(() => named(import('@/pages/RiskPage'), 'RiskPage'))
const ActivityPage = lazy(() => named(import('@/pages/ActivityPage'), 'ActivityPage'))
const SettingsPage = lazy(() => named(import('@/pages/SettingsPage'), 'SettingsPage'))

function LoadingScreen() {
  return (
    <div className="app-aurora flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="relative z-10 flex animate-fade-in flex-col items-center gap-5">
        <Logo />
        <div className="flex items-center gap-2 text-sm text-muted">
          <Spinner className="h-4 w-4" />
          Connecting to bot…
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const init = useBotStore((s) => s.init)
  const loaded = useBotStore((s) => s.loaded)

  useEffect(() => {
    init()
  }, [init])

  useSimulation(1500)

  if (!loaded) return <LoadingScreen />

  return (
    <>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="positions" element={<PositionsPage />} />
          <Route path="markets" element={<MarketsPage />} />
          <Route path="markets/:id" element={<MarketDetailPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="trades" element={<TradesPage />} />
          <Route path="strategies" element={<StrategiesPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="risk" element={<RiskPage />} />
          <Route path="activity" element={<ActivityPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
      <CommandPalette />
      <Toaster />
    </>
  )
}
