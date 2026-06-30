import type { DB } from '../db'
import type { MarketCache } from '../markets'
import type { Broker } from './broker'
import { STRATEGY_DEFS, findArb, findValue } from './strategies'
import { sizeShares, checkKillSwitch } from './risk'
import { markPositions } from '../portfolio'
import { buildPortfolio, buildPerformance } from '../snapshot'
import { getConfig } from '../config'
import { log } from '../log'
import { DAY, pool, round } from '../util'

const MAX_ENTRIES_PER_CYCLE = 3
const ARB_CANDIDATES = 14

/** The scan → decide → trade → manage loop. Owns the timers and the on/off
 *  switch. Opening new trades is gated by `online` and the kill switch;
 *  settlement and equity tracking always run so the dashboard stays truthful. */
export class Bot {
  private refreshTimer: NodeJS.Timeout | null = null
  private tradeTimer: NodeJS.Timeout | null = null
  private ticking = false
  private cycling = false
  private lastSummaryAt = 0
  killed = false

  constructor(
    private db: DB,
    private cache: MarketCache,
    private broker: Broker,
  ) {}

  // --- lifecycle -----------------------------------------------------------
  isOnline(): boolean {
    return this.db.getBool('online', false)
  }
  startedAt(): number {
    return this.db.getNum('startedAt', Date.now())
  }

  async boot(): Promise<void> {
    this.ensureStrategyState()
    if (!this.db.getKv('startedAt')) this.db.setNum('startedAt', Date.now())
    // Seed an equity anchor so the curve has a starting point.
    if (!this.db.equityCurve(1).length) {
      const eq = this.broker.balance()
      this.db.upsertEquityPoint({ t: startOfDay(Date.now()), equity: eq, pnl: 0, drawdown: 0 })
    }
    await this.tick() // prime the market cache before serving

    const cfg = getConfig()
    this.refreshTimer = setInterval(() => void this.tick(), cfg.bot.refreshSeconds * 1000)
    this.tradeTimer = setInterval(() => void this.cycle(), cfg.bot.cycleSeconds * 1000)
    if (cfg.bot.autoStart) this.setOnline(true)
    log.info(`bot booted (online=${this.isOnline()}, mode=paper)`)
  }

  setOnline(on: boolean): void {
    const was = this.isOnline()
    this.db.setBool('online', on)
    if (on && !was) {
      this.db.setNum('startedAt', Date.now())
      this.killed = false
      this.broker.emit('info', 'system', 'Bot started — paper trading enabled')
      // Resume any strategies the kill switch paused.
      for (const d of STRATEGY_DEFS) {
        const st = this.db.strategyStates().find((s) => s.id === d.id)
        if (st && st.status === 'paused') this.db.setStrategyStatus(d.id, 'running')
      }
    } else if (!on && was) {
      this.broker.emit('warning', 'system', 'Bot stopped — no new trades will be opened')
    }
  }

  stopTimers(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer)
    if (this.tradeTimer) clearInterval(this.tradeTimer)
  }

  private ensureStrategyState(): void {
    const have = new Set(this.db.strategyStates().map((s) => s.id))
    for (const d of STRATEGY_DEFS) {
      if (!have.has(d.id)) {
        this.db.upsertStrategyState({
          id: d.id,
          status: 'running',
          params: defaultParams(d.id),
          createdAt: Date.now(),
          lastSignal: Date.now(),
        })
      }
    }
  }

  private strategyRunning(id: string): boolean {
    const st = this.db.strategyStates().find((s) => s.id === id)
    return st ? st.status === 'running' : false
  }

  // --- always-on housekeeping ---------------------------------------------
  private async tick(): Promise<void> {
    if (this.ticking) return
    this.ticking = true
    try {
      await this.cache.refresh()
      // Settle resolved markets (counts even when stopped — it's resolution, not trading).
      for (const t of this.cache.list()) if (t.resolved) this.broker.settle(t)
      if (this.isOnline() && !this.killed) {
        await this.broker.workOpenOrders()
        await this.managePositions()
      }
      this.recordEquity()
      this.persistSummary()
    } catch (err) {
      log.error('tick failed', (err as Error).message)
    } finally {
      this.ticking = false
    }
  }

  /** Persist the computed summary numbers (portfolio + performance) to the DB:
   *  a latest snapshot in kv, plus a 1-minute-bucketed history in `metrics`. */
  private persistSummary(): void {
    const now = Date.now()
    if (now - this.lastSummaryAt < 60_000) return
    this.lastSummaryAt = now
    const cfg = getConfig()
    const marked = markPositions(this.db, this.cache)
    const portfolio = buildPortfolio(this.db, this.broker.balance(), marked, cfg.bot.initialCapital)
    const performance = buildPerformance(this.db, portfolio.equity, cfg.bot.initialCapital)
    const summary = { t: now, portfolio, performance }
    this.db.setKv('summary', JSON.stringify(summary))
    this.db.insertMetric(Math.floor(now / 60_000) * 60_000, summary)
  }

  private recordEquity(): void {
    const marked = markPositions(this.db, this.cache)
    const equity = round(this.broker.balance() + marked.positionsValue)
    const curve = this.db.equityCurve(400)
    const peak = Math.max(equity, ...curve.map((p) => p.equity))
    const cfg = getConfig()
    this.db.upsertEquityPoint({
      t: startOfDay(Date.now()),
      equity,
      pnl: round(equity - cfg.bot.initialCapital),
      drawdown: round(((equity - peak) / peak) * 100, 2),
    })
  }

  /** Take-profit / stop-loss on value & manual positions (arb is held to settlement). */
  private async managePositions(): Promise<void> {
    const cfg = getConfig()
    const marked = markPositions(this.db, this.cache)
    for (const p of marked.positions) {
      if (p.strategyId === 'strat_arb') continue
      const pct = p.unrealizedPnlPct / 100
      const tp = pct >= cfg.risk.takeProfit
      const sl = pct <= -cfg.risk.stopLoss
      if (!tp && !sl) continue
      const t = this.cache.get(p.marketId)
      if (!t) continue
      const books = await this.cache.books(p.marketId)
      const book = p.side === 'YES' ? books.yes : books.no
      const row = this.db.positionFor(p.marketId, p.side)
      if (row) this.broker.sell(row, row.shares, book, tp ? 'take-profit' : 'stop-loss')
    }
  }

  // --- trading cycle -------------------------------------------------------
  private async cycle(): Promise<void> {
    if (this.cycling || !this.isOnline()) return
    this.cycling = true
    try {
      const cfg = getConfig()
      const marked = markPositions(this.db, this.cache)
      const portfolio = buildPortfolio(this.db, this.broker.balance(), marked, cfg.bot.initialCapital)

      // Kill switch — pause everything on a daily-loss breach.
      if (checkKillSwitch(portfolio, cfg, this.db)) {
        if (!this.killed) {
          this.killed = true
          for (const d of STRATEGY_DEFS) this.db.setStrategyStatus(d.id, 'paused')
          this.broker.emit('error', 'risk', 'Kill switch engaged — all strategies paused')
        }
        return
      }
      this.killed = false

      let entries = 0
      const equity = portfolio.equity
      const balance = this.broker.balance()

      // 1) Arbitrage (riskless) — scan top markets' books.
      if (this.strategyRunning('strat_arb')) {
        const candidates = [...this.cache.list()]
          .filter((t) => !t.resolved && t.market.status === 'active')
          .sort((a, b) => b.market.volume24h - a.market.volume24h)
          .slice(0, ARB_CANDIDATES)
        const books = await pool(candidates, 5, (t) => this.cache.books(t.market.id))
        candidates.forEach((t, i) => {
          if (entries >= MAX_ENTRIES_PER_CYCLE) return
          const arb = findArb(t, books[i].yes, books[i].no, cfg)
          if (!arb) return
          const cap = cfg.risk.maxFractionPerTrade * equity
          const affordable = Math.min(cap, this.broker.balance()) / (arb.askYes + arb.askNo)
          const shares = round(Math.min(arb.shares, affordable), 2)
          if (shares < t.minOrderSize) return
          const y = this.broker.buy(t, 'YES', shares, books[i].yes, 'strat_arb', 'Arb Scout', arb.askYes)
          const n = this.broker.buy(t, 'NO', shares, books[i].no, 'strat_arb', 'Arb Scout', arb.askNo)
          if (y || n) {
            entries++
            this.broker.emit(
              'signal',
              'strategy',
              `Arb Scout locked ~${(arb.profitPerShare * 100).toFixed(1)}¢/pair`,
              `${t.market.icon} ${t.market.question.slice(0, 52)}`,
              t.market.id,
            )
          }
        })
      }

      // 2) Mean-reversion value bets (unproven; conservatively sized).
      if (this.strategyRunning('strat_value') && entries < MAX_ENTRIES_PER_CYCLE) {
        const intents = this.cache
          .list()
          .map((t) => findValue(t, cfg))
          .filter((i): i is NonNullable<typeof i> => i !== null)
          .sort((a, b) => b.edge - a.edge)

        for (const intent of intents) {
          if (entries >= MAX_ENTRIES_PER_CYCLE) break
          const t = this.cache.get(intent.marketId)
          if (!t) continue
          // Don't stack onto an outcome we already hold.
          if (this.db.positionFor(intent.marketId, intent.outcome)) continue
          const shares = sizeShares(
            intent.fair,
            intent.price,
            equity,
            balance,
            t.market.category,
            marked,
            t.minOrderSize,
            cfg,
          )
          if (shares <= 0) continue
          const books = await this.cache.books(intent.marketId)
          const book = intent.outcome === 'YES' ? books.yes : books.no
          const trade = this.broker.buy(t, intent.outcome, shares, book, intent.strategyId, intent.strategyName, undefined)
          if (trade) {
            entries++
            this.broker.emit(
              'signal',
              'strategy',
              `Mean Reversion: ${intent.reason}`,
              `${t.market.icon} ${t.market.question.slice(0, 52)} · edge ${(intent.edge * 100).toFixed(1)}¢`,
              t.market.id,
            )
          }
        }
      }

      if (entries > 0) log.info(`cycle: opened ${entries} position(s)`)
    } catch (err) {
      log.error('cycle failed', (err as Error).message)
    } finally {
      this.cycling = false
    }
  }
}

function startOfDay(ms: number): number {
  return Math.floor(ms / DAY) * DAY
}

/** Default tunable params surfaced on the dashboard's strategy cards. */
export function defaultParams(strategyId: string) {
  const cfg = getConfig()
  if (strategyId === 'strat_arb') {
    return [
      { key: 'arbMinProfit', label: 'Min locked profit', value: round(cfg.strategy.arbMinProfit * 100, 1), min: 0.1, max: 5, step: 0.1, unit: '¢' },
      { key: 'maxFractionPerTrade', label: 'Max position size', value: round(cfg.risk.maxFractionPerTrade * 100, 0), min: 1, max: 25, step: 1, unit: '%' },
    ]
  }
  return [
    { key: 'valueMinEdge', label: 'Min edge', value: round(cfg.strategy.valueMinEdge * 100, 1), min: 1, max: 20, step: 0.5, unit: '¢' },
    { key: 'valueLookback', label: 'Lookback', value: cfg.strategy.valueLookback, min: 5, max: 60, step: 1, unit: 'pts' },
    { key: 'kellyFraction', label: 'Kelly fraction', value: cfg.risk.kellyFraction, min: 0.05, max: 1, step: 0.05 },
    { key: 'maxFractionPerTrade', label: 'Max position size', value: round(cfg.risk.maxFractionPerTrade * 100, 0), min: 1, max: 25, step: 1, unit: '%' },
  ]
}
