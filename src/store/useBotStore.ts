import { create } from 'zustand'
import { api } from '@/data/api'
import type { MockData } from '@/data/mock'
import {
  clamp,
  gaussian,
  mulberry32,
  randFloat,
  randInt,
  randomId,
  pick,
} from '@/lib/utils'
import type {
  ActivityEvent,
  BotMode,
  Order,
  OrderSide,
  OrderType,
  OutcomeSide,
  StrategyStatus,
  Trade,
} from '@/types'

const r = (n: number, d = 2) => {
  const f = 10 ** d
  return Math.round(n * f) / f
}
const tickRng = mulberry32((Date.now() & 0xffff) + 7)

// When wired to the real backend, the snapshot poll is the single source of
// truth; this guard prevents overlapping in-flight refreshes.
let refreshing = false

interface PlaceOrderInput {
  marketId: string
  outcome: OutcomeSide
  side: OrderSide
  type: OrderType
  price: number
  size: number
}

interface BotState extends MockData {
  loaded: boolean
  error: string | null
  lastTick: number

  init: () => Promise<void>
  tick: () => void
  refresh: () => Promise<void>

  cancelOrder: (id: string) => void
  closePosition: (id: string) => void
  placeOrder: (input: PlaceOrderInput) => void
  toggleStrategy: (id: string) => void
  setStrategyStatus: (id: string, status: StrategyStatus) => void
  updateStrategyParam: (strategyId: string, key: string, value: number) => void
  acknowledgeAlert: (id: string) => void
  dismissAlert: (id: string) => void
  setBotMode: (mode: BotMode) => void
  toggleBotOnline: () => void
}

const EMPTY: MockData = {
  markets: [],
  strategies: [],
  positions: [],
  orders: [],
  trades: [],
  equityCurve: [],
  portfolio: {
    balance: 0, equity: 0, positionsValue: 0, buyingPower: 0, totalPnl: 0,
    totalPnlPct: 0, realizedPnl: 0, unrealizedPnl: 0, dayPnl: 0, dayPnlPct: 0, exposure: 0,
  },
  performance: {
    winRate: 0, totalTrades: 0, wins: 0, losses: 0, avgWin: 0, avgLoss: 0,
    profitFactor: 0, sharpe: 0, sortino: 0, maxDrawdown: 0, maxDrawdownPct: 0,
    bestTrade: 0, worstTrade: 0, avgHoldHours: 0, expectancy: 0, roi: 0,
  },
  activity: [],
  alerts: [],
  riskLimits: [],
  categoryExposure: [],
  heatmap: [],
  botStatus: {
    online: false, mode: 'idle', connection: 'disconnected', uptimeMs: 0, latencyMs: 0,
    startedAt: Date.now(), version: '0.0.0', wallet: '', network: 'Polygon', gasGwei: 0, apiHealth: [],
  },
  initialCapital: 0,
}

export const useBotStore = create<BotState>((set, get) => ({
  ...EMPTY,
  loaded: false,
  error: null,
  lastTick: Date.now(),

  init: async () => {
    if (get().loaded) return
    try {
      const snapshot = await api.getSnapshot()
      set({ ...snapshot, loaded: true, error: null, lastTick: Date.now() })
    } catch {
      set({ error: 'Failed to connect to bot' })
    }
  },

  // Pull a fresh snapshot from the backend (live mode only).
  refresh: async () => {
    if (refreshing) return
    refreshing = true
    try {
      const snapshot = await api.getSnapshot()
      set({ ...snapshot, loaded: true, error: null, lastTick: Date.now() })
    } catch {
      set({ error: 'Failed to connect to bot' })
    } finally {
      refreshing = false
    }
  },

  tick: () => {
    // Live mode: the backend owns all state — just re-pull the snapshot.
    if (api.isLive) {
      void get().refresh()
      return
    }

    // Mock mode: advance the built-in simulation locally.
    const s = get()
    if (!s.loaded) return
    const now = Date.now()

    // 1. Drift market prices ------------------------------------------------
    const markets = s.markets.map((m) => {
      if (m.status === 'resolved' || m.status === 'paused') return m
      const newYes = clamp(m.yesPrice + gaussian(tickRng, 0, 0.0035), 0.02, 0.98)
      const ref = m.history[m.history.length - 2]?.p ?? newYes
      return {
        ...m,
        prevYesPrice: m.yesPrice,
        yesPrice: r(newYes, 4),
        noPrice: r(1 - newYes, 4),
        bestBid: r(newYes - m.spread / 2, 4),
        bestAsk: r(newYes + m.spread / 2, 4),
        change24h: r((newYes - ref) * 100, 1),
      }
    })
    const byId = new Map(markets.map((m) => [m.id, m]))

    // 2. Re-mark positions --------------------------------------------------
    const positions = s.positions.map((p) => {
      const m = byId.get(p.marketId)
      if (!m) return p
      const currentPrice = p.side === 'YES' ? m.yesPrice : m.noPrice
      const value = r(p.shares * currentPrice)
      const unrealizedPnl = r(value - p.costBasis)
      return {
        ...p,
        currentPrice,
        value,
        unrealizedPnl,
        unrealizedPnlPct: p.costBasis ? r((unrealizedPnl / p.costBasis) * 100, 2) : 0,
      }
    })

    // 3. Recompute portfolio -----------------------------------------------
    const positionsValue = r(positions.reduce((a, p) => a + p.value, 0))
    const unrealizedPnl = r(positions.reduce((a, p) => a + p.unrealizedPnl, 0))
    const equity = r(s.portfolio.balance + positionsValue)
    const dayAnchor = s.equityCurve[s.equityCurve.length - 2]?.equity ?? equity
    const peak = Math.max(...s.equityCurve.map((e) => e.equity), equity)

    const equityCurve = s.equityCurve.map((pt, i) =>
      i === s.equityCurve.length - 1
        ? { ...pt, equity, pnl: r(equity - s.initialCapital), drawdown: r(((equity - peak) / peak) * 100, 2) }
        : pt,
    )

    const portfolio = {
      ...s.portfolio,
      positionsValue,
      unrealizedPnl,
      equity,
      totalPnl: r(equity - s.initialCapital),
      totalPnlPct: r(((equity - s.initialCapital) / s.initialCapital) * 100, 2),
      dayPnl: r(equity - dayAnchor),
      dayPnlPct: r(((equity - dayAnchor) / dayAnchor) * 100, 2),
      exposure: equity ? r(positionsValue / equity, 4) : 0,
      buyingPower: r(s.portfolio.balance * 0.92),
    }

    // 4. Occasionally emit a live event ------------------------------------
    let activity = s.activity
    let trades = s.trades
    if (tickRng() < 0.3) {
      const m = pick(tickRng, markets)
      const outcome: OutcomeSide = tickRng() > 0.5 ? 'YES' : 'NO'
      const side: OrderSide = tickRng() > 0.5 ? 'buy' : 'sell'
      const price = outcome === 'YES' ? m.yesPrice : m.noPrice
      const size = r(randFloat(tickRng, 100, 2400))
      const evt: ActivityEvent = {
        id: randomId('act'),
        level: 'trade',
        category: 'fill',
        message: `${side === 'buy' ? 'Bought' : 'Sold'} ${Math.round(size)} ${outcome} @ ${(price * 100).toFixed(1)}¢`,
        detail: `${m.icon} ${m.question.slice(0, 48)}…`,
        timestamp: now,
        marketId: m.id,
      }
      activity = [evt, ...s.activity].slice(0, 140)
      if (tickRng() < 0.5) {
        const t: Trade = {
          id: randomId('trd'),
          marketId: m.id,
          question: m.question,
          icon: m.icon,
          category: m.category,
          outcome,
          side,
          price: r(price, 3),
          size,
          value: r(size * price),
          fee: r(size * price * 0.001, 2),
          pnl: side === 'sell' ? r(gaussian(tickRng, 80, 320)) : null,
          realized: side === 'sell',
          timestamp: now,
          strategyId: m.id,
          strategyName: pick(tickRng, s.strategies).name,
        }
        trades = [t, ...s.trades].slice(0, 400)
      }
    }

    // 5. Bot vitals ---------------------------------------------------------
    const botStatus = {
      ...s.botStatus,
      uptimeMs: now - s.botStatus.startedAt,
      latencyMs: randInt(tickRng, 26, 78),
      gasGwei: r(clamp(s.botStatus.gasGwei + gaussian(tickRng, 0, 4), 18, 180), 1),
    }

    set({ markets, positions, portfolio, equityCurve, activity, trades, botStatus, lastTick: now })
  },

  cancelOrder: (id) => {
    if (api.isLive) {
      void api.cancelOrder(id).then(() => get().refresh())
      return
    }
    set((s) => ({
      orders: s.orders.filter((o) => o.id !== id),
      activity: [
        {
          id: randomId('act'),
          level: 'warning',
          category: 'order',
          message: 'Order cancelled',
          detail: s.orders.find((o) => o.id === id)?.question.slice(0, 48),
          timestamp: Date.now(),
        } satisfies ActivityEvent,
        ...s.activity,
      ].slice(0, 140),
    }))
  },

  closePosition: (id) => {
    if (api.isLive) {
      void api.closePosition(id).then(() => get().refresh())
      return
    }
    set((s) => {
      const pos = s.positions.find((p) => p.id === id)
      if (!pos) return s
      const realized = pos.unrealizedPnl
      const trade: Trade = {
        id: randomId('trd'),
        marketId: pos.marketId,
        question: pos.question,
        icon: pos.icon,
        category: pos.category,
        outcome: pos.side,
        side: 'sell',
        price: pos.currentPrice,
        size: pos.shares,
        value: pos.value,
        fee: r(pos.value * 0.001, 2),
        pnl: realized,
        realized: true,
        timestamp: Date.now(),
        strategyId: pos.strategyId,
        strategyName: pos.strategyName,
      }
      return {
        positions: s.positions.filter((p) => p.id !== id),
        trades: [trade, ...s.trades].slice(0, 400),
        portfolio: {
          ...s.portfolio,
          balance: r(s.portfolio.balance + pos.value),
          realizedPnl: r(s.portfolio.realizedPnl + realized),
        },
        activity: [
          {
            id: randomId('act'),
            level: realized >= 0 ? 'success' : 'warning',
            category: 'fill',
            message: `Closed ${pos.side} position · ${realized >= 0 ? '+' : ''}$${realized.toFixed(0)} P&L`,
            detail: `${pos.icon} ${pos.question.slice(0, 48)}`,
            timestamp: Date.now(),
          } satisfies ActivityEvent,
          ...s.activity,
        ].slice(0, 140),
      }
    })
  },

  placeOrder: (input) => {
    if (api.isLive) {
      void api.placeOrder(input).then(() => get().refresh())
      return
    }
    set((s) => {
      const m = s.markets.find((mk) => mk.id === input.marketId)
      if (!m) return s
      const order: Order = {
        id: `ord_${randInt(tickRng, 2000, 9999)}`,
        marketId: m.id,
        question: m.question,
        icon: m.icon,
        outcome: input.outcome,
        side: input.side,
        type: input.type,
        price: r(input.price, 3),
        size: r(input.size),
        filled: 0,
        status: 'open',
        tif: 'GTC',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        strategyId: 'manual',
        strategyName: 'Manual',
      }
      return {
        orders: [order, ...s.orders],
        activity: [
          {
            id: randomId('act'),
            level: 'info',
            category: 'order',
            message: `Placed ${input.type} ${input.side} ${Math.round(input.size)} ${input.outcome} @ ${(input.price * 100).toFixed(1)}¢`,
            detail: `${m.icon} ${m.question.slice(0, 48)}`,
            timestamp: Date.now(),
          } satisfies ActivityEvent,
          ...s.activity,
        ].slice(0, 140),
      }
    })
  },

  toggleStrategy: (id) => {
    if (api.isLive) {
      void api.toggleStrategy(id).then(() => get().refresh())
      return
    }
    set((s) => ({
      strategies: s.strategies.map((st) =>
        st.id === id
          ? { ...st, status: st.status === 'running' ? 'paused' : 'running' }
          : st,
      ),
    }))
  },

  setStrategyStatus: (id, status) => {
    if (api.isLive) {
      void api.setStrategyStatus(id, status).then(() => get().refresh())
      return
    }
    set((s) => ({
      strategies: s.strategies.map((st) => (st.id === id ? { ...st, status } : st)),
    }))
  },

  updateStrategyParam: (strategyId, key, value) => {
    if (api.isLive) {
      void api.updateStrategyParam(strategyId, key, value).then(() => get().refresh())
      return
    }
    set((s) => ({
      strategies: s.strategies.map((st) =>
        st.id === strategyId
          ? { ...st, params: st.params.map((p) => (p.key === key ? { ...p, value } : p)) }
          : st,
      ),
    }))
  },

  acknowledgeAlert: (id) => {
    if (api.isLive) {
      void api.acknowledgeAlert(id).then(() => get().refresh())
      return
    }
    set((s) => ({
      alerts: s.alerts.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)),
    }))
  },

  dismissAlert: (id) => {
    if (api.isLive) {
      void api.dismissAlert(id).then(() => get().refresh())
      return
    }
    set((s) => ({ alerts: s.alerts.filter((a) => a.id !== id) }))
  },

  setBotMode: (mode) => {
    if (api.isLive) {
      void api.setBotMode(mode).then(() => get().refresh())
      return
    }
    set((s) => ({ botStatus: { ...s.botStatus, mode } }))
  },

  toggleBotOnline: () => {
    if (api.isLive) {
      const desired = !get().botStatus.online
      void api.setBotOnline(desired).then(() => get().refresh())
      return
    }
    set((s) => ({
      botStatus: {
        ...s.botStatus,
        online: !s.botStatus.online,
        connection: !s.botStatus.online ? 'connected' : 'disconnected',
        mode: !s.botStatus.online ? 'live' : 'idle',
      },
    }))
  },
}))
