import { Suspense, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar, MobileSidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { MarketTicker } from '@/components/common/MarketTicker'
import { Spinner } from '@/components/ui'

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [location.pathname])

  return (
    <div className="app-aurora relative flex min-h-screen bg-background">
      <Sidebar />
      <MobileSidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="relative z-[1] flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setMobileOpen(true)} />
        <MarketTicker />
        <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-5 sm:px-6 lg:px-8">
          <Suspense
            fallback={
              <div className="flex min-h-[60vh] items-center justify-center text-muted">
                <Spinner className="h-6 w-6" />
              </div>
            }
          >
            <div key={location.pathname} className="animate-fade-in">
              <Outlet />
            </div>
          </Suspense>
        </main>
        <Footer />
      </div>
    </div>
  )
}

function Footer() {
  return (
    <footer className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8">
      <div className="flex flex-col items-center justify-between gap-2 border-t border-border pt-4 text-[11px] text-muted-2 sm:flex-row">
        <span>
          Quantum Dashboard · Demo data from a simulated feed — wire{' '}
          <code className="rounded bg-surface-2 px-1 py-0.5 text-[10px]">src/data/api.ts</code> to
          your bot.
        </span>
        <span>Not financial advice.</span>
      </div>
    </footer>
  )
}
