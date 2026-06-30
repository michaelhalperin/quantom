import { useEffect } from 'react'
import { useBotStore } from '@/store/useBotStore'
import { api } from '@/data/api'

/**
 * Drives live updates. In mock mode it advances the built-in simulation while
 * the bot is "online". When wired to the real backend (VITE_BOT_API set), it
 * polls the snapshot endpoint continuously — the server is the source of truth,
 * so updates flow whether or not the trading loop is running.
 */
export function useSimulation(intervalMs = 1500) {
  const tick = useBotStore((s) => s.tick)
  const loaded = useBotStore((s) => s.loaded)
  const online = useBotStore((s) => s.botStatus.online)

  useEffect(() => {
    if (!loaded) return
    // Mock mode only advances while online; live mode always polls.
    if (!api.isLive && !online) return
    const interval = api.isLive ? Math.max(intervalMs, 2500) : intervalMs
    const id = setInterval(tick, interval)
    return () => clearInterval(id)
  }, [tick, loaded, online, intervalMs])
}
