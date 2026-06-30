import { createMockData, generateOrderBook, type MockData } from './mock'
import type { BotMode, Market, OrderBook, OrderSide, OrderType, OutcomeSide, StrategyStatus } from '@/types'
import { sleep } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Service layer — the ONLY boundary between the UI and "the backend".
//
// If VITE_BOT_API is set (see .env.local), every method talks to the real
// paper-trading backend in server/. Otherwise the dashboard falls back to the
// built-in simulated data feed, so it still runs standalone as a demo.
//
// The return *types* are the contract the whole dashboard is built against; the
// backend's /snapshot and /book endpoints return exactly these shapes.
// ---------------------------------------------------------------------------

const BASE = import.meta.env.VITE_BOT_API?.replace(/\/$/, '')
const LIVE = !!BASE

// --- mock fallback (only used when no backend is configured) ---------------
const LATENCY = 320
let cache: MockData | null = null
function mock(): MockData {
  if (!cache) cache = createMockData()
  return cache
}

// --- live HTTP helpers ------------------------------------------------------
async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return (await res.json()) as T
}
async function post(path: string, body?: unknown): Promise<void> {
  try {
    await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    /* swallow — the next snapshot refresh reflects the true state */
  }
}

export interface PlaceOrderInput {
  marketId: string
  outcome: OutcomeSide
  side: OrderSide
  type: OrderType
  price: number
  size: number
}

export interface BotSettings {
  ui: Record<string, unknown>
  risk: { dailyLossLimitPct: number; maxGrossExposurePct: number; autoKillSwitch: boolean }
}

export interface SaveSettingsInput {
  ui?: Record<string, unknown>
  risk?: Partial<BotSettings['risk']>
}

export const api = {
  /** True when wired to the real backend; the store uses this to branch. */
  isLive: LIVE,

  /** Full snapshot of the bot's world. */
  async getSnapshot(): Promise<MockData> {
    if (LIVE) return getJson<MockData>('/snapshot')
    await sleep(LATENCY)
    return mock()
  },

  /** Live order book for a single market. */
  async getOrderBook(market: Market): Promise<OrderBook> {
    if (LIVE) return getJson<OrderBook>(`/book/${encodeURIComponent(market.id)}`)
    await sleep(140)
    return generateOrderBook(market)
  },

  // --- commands -------------------------------------------------------------
  // In mock mode these are no-ops; the store applies its own local updates.
  async placeOrder(input: PlaceOrderInput): Promise<void> {
    if (LIVE) await post('/orders', input)
  },
  async cancelOrder(id: string): Promise<void> {
    if (LIVE) await post(`/orders/${encodeURIComponent(id)}/cancel`)
  },
  async closePosition(id: string): Promise<void> {
    if (LIVE) await post(`/positions/${encodeURIComponent(id)}/close`)
  },
  async toggleStrategy(id: string): Promise<void> {
    if (LIVE) await post(`/strategies/${encodeURIComponent(id)}/toggle`)
  },
  async setStrategyStatus(id: string, status: StrategyStatus): Promise<void> {
    if (LIVE) await post(`/strategies/${encodeURIComponent(id)}/status`, { status })
  },
  async updateStrategyParam(id: string, key: string, value: number): Promise<void> {
    if (LIVE) await post(`/strategies/${encodeURIComponent(id)}/params`, { key, value })
  },
  async acknowledgeAlert(id: string): Promise<void> {
    if (LIVE) await post(`/alerts/${encodeURIComponent(id)}/ack`)
  },
  async dismissAlert(id: string): Promise<void> {
    if (LIVE) await post(`/alerts/${encodeURIComponent(id)}`)
  },
  async setBotOnline(online: boolean): Promise<void> {
    if (LIVE) await post('/bot/online', { online })
  },
  async setBotMode(mode: BotMode): Promise<void> {
    if (LIVE) await post('/bot/mode', { mode })
  },

  /** Load saved settings from the backend (null in mock mode). */
  async getSettings(): Promise<BotSettings | null> {
    if (LIVE) return getJson<BotSettings>('/settings')
    return null
  },
  /** Persist the settings form to the backend. */
  async saveSettings(input: SaveSettingsInput): Promise<void> {
    if (LIVE) await post('/settings', input)
  },
}

export type { MockData }
