import type { DB } from './db'
import type { MarketCache } from './markets'
import type { Marked } from './portfolio'
import { markPositions } from './portfolio'
import { buildRiskLimits } from './engine/risk'
import { STRATEGY_DEFS } from './engine/strategies'
import { apiHealth } from './polymarket/client'
import { getConfig } from './config'
import { mean, round, stddev, DAY, HOUR } from './util'
import type {
  Snapshot,
  Market,
  Strategy,
  PortfolioSnapshot,
  PerformanceStats,
  CategoryExposure,
  HeatCell,
  BotStatus,
  PricePoint,
} from './types'

export interface BotInfo {
  online: boolean
  startedAt: number
}

/** Portfolio snapshot — also used by the bot for the kill-switch check. */
export function buildPortfolio(db: DB, balance: number, marked: Marked, initialCapital: number): PortfolioSnapshot {
  const positionsValue = marked.positionsValue
  const equity = round(balance + positionsValue)
  const curve = db.equityCurve(90)
  const dayAnchor = curve.length >= 2 ? curve[curve.length - 2].equity : equity
  const realizedPnl = round(db.allRealizedTrades().reduce((s, t) => s + (t.pnl ?? 0), 0))
  const totalPnl = round(equity - initialCapital)
  return {
    balance: round(balance),
    equity,
    positionsValue,
    buyingPower: round(balance),
    totalPnl,
    totalPnlPct: round((totalPnl / (initialCapital || 1)) * 100, 2),
    realizedPnl,
    unrealizedPnl: marked.unrealizedPnl,
    dayPnl: round(equity - dayAnchor),
    dayPnlPct: round(((equity - dayAnchor) / (dayAnchor || 1)) * 100, 2),
    exposure: equity ? round(positionsValue / equity, 4) : 0,
  }
}

export function buildPerformance(db: DB, equity: number, initialCapital: number): PerformanceStats {
  const realized = db.allRealizedTrades()
  const wins = realized.filter((t) => (t.pnl ?? 0) > 0)
  const losses = realized.filter((t) => (t.pnl ?? 0) < 0)
  const grossProfit = wins.reduce((s, t) => s + (t.pnl ?? 0), 0)
  const grossLoss = Math.abs(losses.reduce((s, t) => s + (t.pnl ?? 0), 0))
  const avgWin = wins.length ? grossProfit / wins.length : 0
  const avgLoss = losses.length ? grossLoss / losses.length : 0
  const winRate = realized.length ? wins.length / realized.length : 0

  const curve = db.equityCurve(90)
  const returns = curve.slice(1).map((p, i) => (curve[i].equity ? p.equity / curve[i].equity - 1 : 0))
  const downside = returns.filter((r) => r < 0)
  const sd = stddev(returns)
  const sharpe = sd ? (mean(returns) / sd) * Math.sqrt(365) : 0
  const sortino = stddev(downside) ? (mean(returns) / stddev(downside)) * Math.sqrt(365) : 0
  const maxDdPct = curve.length ? Math.min(0, ...curve.map((p) => p.drawdown)) : 0
  const peak = curve.length ? Math.max(...curve.map((p) => p.equity)) : equity

  const open = db.positions()
  const avgHoldHours = open.length
    ? mean(open.map((p) => (Date.now() - p.openedAt) / HOUR))
    : 0
  const totalPnl = equity - initialCapital

  return {
    winRate: round(winRate, 4),
    totalTrades: realized.length,
    wins: wins.length,
    losses: losses.length,
    avgWin: round(avgWin),
    avgLoss: round(avgLoss),
    profitFactor: round(grossLoss ? grossProfit / grossLoss : grossProfit, 2),
    sharpe: round(sharpe, 2),
    sortino: round(sortino, 2),
    maxDrawdown: round((maxDdPct / 100) * peak),
    maxDrawdownPct: round(maxDdPct, 2),
    bestTrade: realized.length ? round(Math.max(...realized.map((t) => t.pnl ?? 0))) : 0,
    worstTrade: realized.length ? round(Math.min(...realized.map((t) => t.pnl ?? 0))) : 0,
    avgHoldHours: round(avgHoldHours, 1),
    expectancy: round(winRate * avgWin - (1 - winRate) * avgLoss),
    roi: round((totalPnl / (initialCapital || 1)) * 100, 2),
  }
}

function buildStrategies(db: DB, marked: Marked): Strategy[] {
  const states = db.strategyStates()
  const allTrades = db.trades(5000)
  const now = Date.now()

  return STRATEGY_DEFS.map((def) => {
    const st = states.find((s) => s.id === def.id)
    const trades = allTrades.filter((t) => t.strategyId === def.id)
    const realized = trades.filter((t) => t.pnl !== null)
    const wins = realized.filter((t) => (t.pnl ?? 0) > 0)
    const realizedPnl = realized.reduce((s, t) => s + (t.pnl ?? 0), 0)
    const unrealized = marked.positions
      .filter((p) => p.strategyId === def.id)
      .reduce((s, p) => s + p.unrealizedPnl, 0)
    const pnl7d = realized
      .filter((t) => t.timestamp > now - 7 * DAY)
      .reduce((s, t) => s + (t.pnl ?? 0), 0)
    const pnls = realized.map((t) => t.pnl ?? 0)
    const sd = stddev(pnls)

    // Per-trade equity sparkline from cumulative realized P&L.
    const equity: PricePoint[] = []
    let cum = 0
    const chrono = [...realized].sort((a, b) => a.timestamp - b.timestamp)
    for (const t of chrono.slice(-30)) {
      cum += t.pnl ?? 0
      equity.push({ t: t.timestamp, p: round(cum, 2) })
    }
    if (!equity.length) equity.push({ t: now - DAY, p: 0 }, { t: now, p: round(unrealized, 2) })

    // Per-strategy max drawdown from the cumulative curve.
    let peak = -Infinity
    let maxDd = 0
    let run = 0
    for (const t of chrono) {
      run += t.pnl ?? 0
      peak = Math.max(peak, run)
      maxDd = Math.min(maxDd, run - peak)
    }

    const markets = new Set(
      marked.positions.filter((p) => p.strategyId === def.id).map((p) => p.marketId),
    )
    const lastSignal = trades.length ? Math.max(...trades.map((t) => t.timestamp)) : st?.lastSignal ?? now

    return {
      id: def.id,
      name: def.name,
      kind: def.kind,
      status: st?.status ?? 'running',
      description: def.description,
      allocation: round(
        marked.positions.filter((p) => p.strategyId === def.id).reduce((s, p) => s + p.value, 0),
      ),
      pnl: round(realizedPnl + unrealized),
      pnl7d: round(pnl7d),
      winRate: realized.length ? round(wins.length / realized.length, 3) : 0,
      trades: trades.length,
      sharpe: sd ? round(mean(pnls) / sd, 2) : 0,
      maxDrawdown: round(maxDd),
      markets: markets.size,
      params: st?.params ?? [],
      equity,
      createdAt: st?.createdAt ?? now,
      lastSignal,
    }
  })
}

function buildCategoryExposure(marked: Marked): CategoryExposure[] {
  return [...marked.byCategory.entries()]
    .map(([category, e]) => ({ category, value: round(e.value), pnl: round(e.pnl) }))
    .sort((a, b) => b.value - a.value)
}

function buildHeatmap(db: DB): HeatCell[] {
  const trades = db.trades(5000)
  const cells = new Map<string, HeatCell>()
  for (let d = 0; d < 7; d++)
    for (let h = 0; h < 24; h++) cells.set(`${d}-${h}`, { day: d, hour: h, pnl: 0, trades: 0 })
  for (const t of trades) {
    const date = new Date(t.timestamp)
    const day = (date.getDay() + 6) % 7 // Mon=0 … Sun=6
    const hour = date.getHours()
    const cell = cells.get(`${day}-${hour}`)!
    cell.trades += 1
    cell.pnl = round(cell.pnl + (t.pnl ?? 0))
  }
  return [...cells.values()]
}

function buildBotStatus(info: BotInfo, cache: MarketCache): BotStatus {
  const health = apiHealth()
  const fresh = Date.now() - cache.lastRefresh < 60_000
  const connection = !fresh ? 'disconnected' : health.gamma.ok && health.clob.ok ? 'connected' : 'degraded'
  return {
    online: info.online,
    mode: info.online ? 'paper' : 'idle',
    connection,
    uptimeMs: Math.max(0, Date.now() - info.startedAt),
    latencyMs: Math.max(health.gamma.latencyMs, health.clob.latencyMs),
    startedAt: info.startedAt,
    version: '1.0.0-paper',
    wallet: 'paper-account · no wallet (simulated)',
    network: 'Polygon',
    gasGwei: 0,
    apiHealth: [
      { name: 'Gamma API', ok: health.gamma.ok, latencyMs: health.gamma.latencyMs },
      { name: 'CLOB API', ok: health.clob.ok, latencyMs: health.clob.latencyMs },
      { name: 'Paper broker', ok: true, latencyMs: 0 },
      { name: 'Database', ok: true, latencyMs: 0 },
    ],
  }
}

/** Assemble the full snapshot the dashboard's getSnapshot() returns. */
export function buildSnapshot(db: DB, cache: MarketCache, info: BotInfo): Snapshot {
  const cfg = getConfig()
  const marked = markPositions(db, cache)
  const balance = db.getNum('balance', cfg.bot.initialCapital)
  const portfolio = buildPortfolio(db, balance, marked, cfg.bot.initialCapital)

  const heldMarketIds = new Set(marked.positions.map((p) => p.marketId))
  const markets: Market[] = cache
    .list()
    .map((t) => ({ ...t.market, botActive: heldMarketIds.has(t.market.id) }))
    .sort((a, b) => b.volume24h - a.volume24h)

  const openOrders = db.openOrders()

  return {
    markets,
    strategies: buildStrategies(db, marked),
    positions: marked.positions.sort((a, b) => b.value - a.value),
    orders: openOrders,
    trades: db.trades(400),
    equityCurve: clampCurve(db.equityCurve(90)),
    portfolio,
    performance: buildPerformance(db, portfolio.equity, cfg.bot.initialCapital),
    activity: db.activity(140),
    alerts: db.alerts(50),
    riskLimits: buildRiskLimits(portfolio, marked, openOrders.length, cfg),
    categoryExposure: buildCategoryExposure(marked),
    heatmap: buildHeatmap(db),
    botStatus: buildBotStatus(info, cache),
    initialCapital: cfg.bot.initialCapital,
  }
}

/** Guard against a degenerate single-point curve so charts always render. */
function clampCurve(curve: { t: number; equity: number; pnl: number; drawdown: number }[]) {
  if (curve.length >= 2) return curve
  const only = curve[0]
  if (!only) return curve
  return [{ t: only.t - DAY, equity: only.equity, pnl: 0, drawdown: 0 }, only]
}
