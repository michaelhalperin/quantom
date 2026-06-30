import {
  mulberry32,
  clamp,
  gaussian,
  randFloat,
  randInt,
  pick,
  range,
  randomId,
  mean,
  stddev,
} from '@/lib/utils'
import type {
  Market,
  MarketCategory,
  MarketStatus,
  Position,
  Order,
  Trade,
  Strategy,
  StrategyKind,
  StrategyStatus,
  StrategyParam,
  OutcomeSide,
  PricePoint,
  BotStatus,
  PortfolioSnapshot,
  PerformanceStats,
  ActivityEvent,
  ActivityLevel,
  RiskAlert,
  RiskLimit,
  EquityPoint,
  CategoryExposure,
  HeatCell,
  OrderBook,
  OrderBookLevel,
} from '@/types'

const DAY = 86_400_000
const HOUR = 3_600_000
const round = (n: number, d = 2) => {
  const f = 10 ** d
  return Math.round(n * f) / f
}

// ---------------------------------------------------------------------------
// Market templates — realistic Polymarket-style questions.
// ---------------------------------------------------------------------------
interface MarketTemplate {
  q: string
  cat: MarketCategory
  icon: string
  base: number // anchor YES price
  tags: string[]
}

const TEMPLATES: MarketTemplate[] = [
  { q: 'Will the Fed cut interest rates at the July 2026 meeting?', cat: 'Economics', icon: '🏦', base: 0.41, tags: ['Fed', 'Rates', 'FOMC'] },
  { q: 'Will Bitcoin close above $150,000 at any point in 2026?', cat: 'Crypto', icon: '₿', base: 0.63, tags: ['Bitcoin', 'Price'] },
  { q: 'Will the US government shut down before October 2026?', cat: 'Politics', icon: '🏛️', base: 0.28, tags: ['Congress', 'Budget'] },
  { q: 'Will OpenAI release a model branded "GPT-6" before 2027?', cat: 'Tech', icon: '🤖', base: 0.47, tags: ['AI', 'OpenAI'] },
  { q: 'Will Real Madrid win the 2026 Champions League?', cat: 'Sports', icon: '⚽', base: 0.22, tags: ['Soccer', 'UCL'] },
  { q: 'Will WTI crude oil close above $90 in Q3 2026?', cat: 'Economics', icon: '🛢️', base: 0.34, tags: ['Oil', 'Commodities'] },
  { q: 'Will Avatar 3 gross over $2B worldwide?', cat: 'Pop Culture', icon: '🎬', base: 0.56, tags: ['Box Office', 'Movies'] },
  { q: 'Will SpaceX Starship reach Mars transfer orbit by 2027?', cat: 'Science', icon: '🚀', base: 0.19, tags: ['SpaceX', 'Mars'] },
  { q: 'Will Ethereum flip Bitcoin by market cap in 2026?', cat: 'Crypto', icon: '💎', base: 0.09, tags: ['Ethereum', 'Flippening'] },
  { q: 'Will the Lakers reach the 2026 NBA Finals?', cat: 'Sports', icon: '🏀', base: 0.31, tags: ['NBA', 'Basketball'] },
  { q: 'Will 2026 be confirmed the hottest year on record?', cat: 'Science', icon: '🌡️', base: 0.72, tags: ['Climate', 'Temperature'] },
  { q: 'Will the S&P 500 close above 7,000 in 2026?', cat: 'Economics', icon: '📈', base: 0.58, tags: ['Stocks', 'S&P'] },
  { q: 'Will a spot Solana ETF begin trading in 2026?', cat: 'Crypto', icon: '🪙', base: 0.66, tags: ['Solana', 'ETF'] },
  { q: 'Will Nvidia reach a $5T market cap in 2026?', cat: 'Tech', icon: '💻', base: 0.44, tags: ['Nvidia', 'Stocks'] },
  { q: 'Will US headline CPI exceed 4% year-over-year in 2026?', cat: 'Economics', icon: '💵', base: 0.26, tags: ['Inflation', 'CPI'] },
  { q: 'Will there be a Russia–Ukraine ceasefire by Q4 2026?', cat: 'Geopolitics', icon: '🕊️', base: 0.38, tags: ['Ukraine', 'War'] },
  { q: 'Will GTA 6 sell 30M+ copies in its launch quarter?', cat: 'Pop Culture', icon: '🎮', base: 0.61, tags: ['Gaming', 'Rockstar'] },
  { q: 'Will the incumbent party hold the House in the 2026 midterms?', cat: 'Politics', icon: '🗳️', base: 0.49, tags: ['Midterms', 'Congress'] },
  { q: 'Will Apple ship a foldable iPhone in 2026?', cat: 'Tech', icon: '📱', base: 0.17, tags: ['Apple', 'Hardware'] },
  { q: 'Will the US win the most golds at the 2026 Winter Olympics?', cat: 'Sports', icon: '🥇', base: 0.36, tags: ['Olympics'] },
  { q: 'Will China conduct a Taiwan naval blockade drill in 2026?', cat: 'Geopolitics', icon: '🛳️', base: 0.43, tags: ['China', 'Taiwan'] },
  { q: 'Will an AI system win an IMO gold medal in 2026?', cat: 'Science', icon: '🧠', base: 0.54, tags: ['AI', 'Math'] },
  { q: 'Will Tesla deliver a sub-$25k vehicle in 2026?', cat: 'Tech', icon: '🚗', base: 0.33, tags: ['Tesla', 'EV'] },
  { q: 'Will a US recession be declared by NBER in 2026?', cat: 'Economics', icon: '📉', base: 0.24, tags: ['Recession', 'Macro'] },
  { q: 'Will Dogecoin reach $1 in 2026?', cat: 'Crypto', icon: '🐶', base: 0.12, tags: ['Doge', 'Meme'] },
  { q: 'Will Taylor Swift announce a 2026 stadium tour?', cat: 'Pop Culture', icon: '🎤', base: 0.69, tags: ['Music', 'Tour'] },
]

const STRATEGY_DEFS: Array<{
  name: string
  kind: StrategyKind
  status: StrategyStatus
  description: string
}> = [
  { name: 'Delta Maker', kind: 'market-making', status: 'running', description: 'Two-sided quoting on high-liquidity political and macro markets, capturing spread while staying delta-neutral.' },
  { name: 'Momentum Edge', kind: 'momentum', status: 'running', description: 'Rides probability breakouts confirmed by volume surges across crypto and sports markets.' },
  { name: 'Mean Hunter', kind: 'mean-reversion', status: 'running', description: 'Fades overreactions in mid-probability markets back toward fair value.' },
  { name: 'Cross-Venue Arb', kind: 'arbitrage', status: 'paused', description: 'Exploits YES/NO mispricings and cross-market dutch-book opportunities.' },
  { name: 'Signal Reader', kind: 'news-sentiment', status: 'running', description: 'Trades fast on classified news headlines and on-chain sentiment shifts.' },
  { name: 'Whale Tail', kind: 'copy-trading', status: 'error', description: 'Mirrors a basket of profitable on-chain wallets with size scaling and slippage caps.' },
]

function paramsFor(kind: StrategyKind, rng: () => number): StrategyParam[] {
  const common: StrategyParam[] = [
    { key: 'maxPos', label: 'Max position size', value: randInt(rng, 500, 4000), min: 100, max: 10000, step: 100, unit: '$' },
    { key: 'maxExposure', label: 'Max market exposure', value: randInt(rng, 5, 25), min: 1, max: 50, step: 1, unit: '%' },
  ]
  const byKind: Record<StrategyKind, StrategyParam[]> = {
    'market-making': [
      { key: 'spread', label: 'Target spread', value: round(randFloat(rng, 1, 4), 1), min: 0.5, max: 10, step: 0.5, unit: '¢' },
      { key: 'depth', label: 'Quote depth', value: randInt(rng, 2, 6), min: 1, max: 10, step: 1, unit: 'lvl' },
      { key: 'skew', label: 'Inventory skew', value: round(randFloat(rng, 0.1, 0.6), 2), min: 0, max: 1, step: 0.05 },
    ],
    momentum: [
      { key: 'lookback', label: 'Lookback window', value: randInt(rng, 6, 48), min: 1, max: 96, step: 1, unit: 'h' },
      { key: 'threshold', label: 'Breakout threshold', value: round(randFloat(rng, 2, 8), 1), min: 1, max: 20, step: 0.5, unit: '%' },
    ],
    'mean-reversion': [
      { key: 'zEntry', label: 'Z-score entry', value: round(randFloat(rng, 1.5, 2.5), 1), min: 0.5, max: 4, step: 0.1 },
      { key: 'halfLife', label: 'Half-life', value: randInt(rng, 4, 24), min: 1, max: 72, step: 1, unit: 'h' },
    ],
    arbitrage: [
      { key: 'minEdge', label: 'Min edge', value: round(randFloat(rng, 0.5, 2), 1), min: 0.1, max: 5, step: 0.1, unit: '¢' },
      { key: 'legs', label: 'Max legs', value: randInt(rng, 2, 4), min: 2, max: 6, step: 1 },
    ],
    'news-sentiment': [
      { key: 'reaction', label: 'Reaction latency', value: randInt(rng, 200, 1200), min: 50, max: 5000, step: 50, unit: 'ms' },
      { key: 'conviction', label: 'Min conviction', value: randInt(rng, 60, 85), min: 50, max: 99, step: 1, unit: '%' },
    ],
    'copy-trading': [
      { key: 'wallets', label: 'Tracked wallets', value: randInt(rng, 5, 20), min: 1, max: 50, step: 1 },
      { key: 'scale', label: 'Size scale', value: round(randFloat(rng, 0.1, 0.5), 2), min: 0.05, max: 1, step: 0.05, unit: 'x' },
    ],
  }
  return [...byKind[kind], ...common]
}

function makeSparkline(rng: () => number, points: number, drift: number): PricePoint[] {
  const now = Date.now()
  let v = randFloat(rng, 0.8, 1.2)
  const out: PricePoint[] = []
  for (let i = points - 1; i >= 0; i--) {
    v += gaussian(rng, drift, 0.04)
    out.push({ t: now - i * DAY, p: round(Math.max(0.3, v), 3) })
  }
  return out
}

function genHistory(rng: () => number, base: number, points: number): PricePoint[] {
  const now = Date.now()
  const target = clamp(base + gaussian(rng, 0, 0.08), 0.05, 0.95)
  let p = clamp(base + gaussian(rng, 0, 0.12), 0.05, 0.95)
  const vol = randFloat(rng, 0.012, 0.03)
  const out: PricePoint[] = []
  for (let i = points - 1; i >= 0; i--) {
    p += gaussian(rng, 0, vol) + (target - p) * 0.03
    p = clamp(p, 0.02, 0.98)
    out.push({ t: now - i * DAY, p: round(p, 4) })
  }
  return out
}

const WALLET = '0x7A3fB91c4D2e8A6b0F15c9E84d2A7b3C6e1F0a92'
const STRATEGY_NAMES_FALLBACK = 'Manual'

export interface MockData {
  markets: Market[]
  strategies: Strategy[]
  positions: Position[]
  orders: Order[]
  trades: Trade[]
  equityCurve: EquityPoint[]
  portfolio: PortfolioSnapshot
  performance: PerformanceStats
  activity: ActivityEvent[]
  alerts: RiskAlert[]
  riskLimits: RiskLimit[]
  categoryExposure: CategoryExposure[]
  heatmap: HeatCell[]
  botStatus: BotStatus
  initialCapital: number
}

export function createMockData(seed = 42): MockData {
  const rng = mulberry32(seed)
  const now = Date.now()
  const initialCapital = 25_000

  // --- Strategies ---------------------------------------------------------
  const strategies: Strategy[] = STRATEGY_DEFS.map((def, i) => {
    const trades = randInt(rng, 40, 520)
    const pnl = round(randFloat(rng, -1800, 9000) * (def.status === 'error' ? -0.3 : 1))
    return {
      id: `strat_${i + 1}`,
      name: def.name,
      kind: def.kind,
      status: def.status,
      description: def.description,
      allocation: round(randFloat(rng, 3000, 14000)),
      pnl,
      pnl7d: round(randFloat(rng, -600, 1800)),
      winRate: round(randFloat(rng, 0.46, 0.71), 3),
      trades,
      sharpe: round(randFloat(rng, 0.4, 2.8), 2),
      maxDrawdown: round(randFloat(rng, -22, -4), 1),
      markets: randInt(rng, 2, 11),
      params: paramsFor(def.kind, rng),
      equity: makeSparkline(rng, 30, pnl > 0 ? 0.01 : -0.004),
      createdAt: now - randInt(rng, 30, 180) * DAY,
      lastSignal: now - randInt(rng, 0, 90) * 60_000,
    }
  })
  const runningStrategies = strategies.filter((s) => s.status === 'running')

  // --- Markets ------------------------------------------------------------
  const markets: Market[] = TEMPLATES.map((t, i) => {
    const history = genHistory(rng, t.base, 90)
    const yesPrice = history[history.length - 1].p
    const prevYesPrice = history[history.length - 2].p
    const spread = round(randFloat(rng, 0.004, 0.02), 4)
    const status: MarketStatus = pick(rng, [
      'active', 'active', 'active', 'active', 'closing-soon', 'paused',
    ] as MarketStatus[])
    const volumeTotal = round(randFloat(rng, 0.4e6, 28e6))
    return {
      id: `mkt_${i + 1}`,
      slug: t.q.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 48).replace(/-+$/, ''),
      question: t.q,
      category: t.cat,
      status,
      icon: t.icon,
      yesPrice,
      noPrice: round(1 - yesPrice, 4),
      prevYesPrice,
      change24h: round((yesPrice - prevYesPrice) * 100, 1),
      volume24h: round(volumeTotal * randFloat(rng, 0.02, 0.12)),
      volumeTotal,
      liquidity: round(randFloat(rng, 40_000, 900_000)),
      openInterest: round(randFloat(rng, 80_000, 3.4e6)),
      endDate: now + randInt(rng, 5, 300) * DAY,
      createdAt: now - randInt(rng, 30, 200) * DAY,
      spread,
      bestBid: round(yesPrice - spread / 2, 4),
      bestAsk: round(yesPrice + spread / 2, 4),
      history,
      tags: t.tags,
      traders: randInt(rng, 220, 18_400),
      botActive: rng() > 0.45,
    }
  })
  const activeMarkets = markets.filter((m) => m.status !== 'resolved')

  // --- Positions ----------------------------------------------------------
  const posCount = 12
  const positions: Position[] = range(posCount).map((i) => {
    const m = activeMarkets[(i * 2 + 1) % activeMarkets.length]
    const side: OutcomeSide = rng() > 0.42 ? 'YES' : 'NO'
    const currentPrice = side === 'YES' ? m.yesPrice : m.noPrice
    const avgPrice = clamp(currentPrice + gaussian(rng, 0, 0.08), 0.03, 0.97)
    const shares = round(randFloat(rng, 200, 6000))
    const costBasis = round(shares * avgPrice)
    const value = round(shares * currentPrice)
    const strat = pick(rng, runningStrategies.length ? runningStrategies : strategies)
    return {
      id: `pos_${i + 1}`,
      marketId: m.id,
      question: m.question,
      category: m.category,
      icon: m.icon,
      side,
      shares,
      avgPrice: round(avgPrice, 4),
      currentPrice: round(currentPrice, 4),
      costBasis,
      value,
      unrealizedPnl: round(value - costBasis),
      unrealizedPnlPct: round(((value - costBasis) / costBasis) * 100, 2),
      realizedPnl: round(randFloat(rng, -200, 600)),
      openedAt: now - randInt(rng, 1, 28) * DAY - randInt(rng, 0, 23) * HOUR,
      strategyId: strat.id,
      strategyName: strat.name,
    }
  })

  // --- Open orders --------------------------------------------------------
  const orders: Order[] = range(9).map((i) => {
    const m = pick(rng, activeMarkets)
    const outcome: OutcomeSide = rng() > 0.5 ? 'YES' : 'NO'
    const side = rng() > 0.5 ? 'buy' : 'sell'
    const ref = outcome === 'YES' ? m.yesPrice : m.noPrice
    const price = clamp(ref + gaussian(rng, 0, 0.03), 0.02, 0.98)
    const size = round(randFloat(rng, 150, 4500))
    const filled = rng() > 0.6 ? round(size * randFloat(rng, 0, 0.8)) : 0
    const strat = pick(rng, strategies)
    return {
      id: `ord_${1000 + i}`,
      marketId: m.id,
      question: m.question,
      icon: m.icon,
      outcome,
      side,
      type: rng() > 0.25 ? 'limit' : 'market',
      price: round(price, 3),
      size,
      filled,
      status: filled > 0 ? 'partial' : 'open',
      tif: pick(rng, ['GTC', 'GTC', 'IOC', 'GTD'] as const),
      createdAt: now - randInt(rng, 0, 240) * 60_000,
      updatedAt: now - randInt(rng, 0, 30) * 60_000,
      strategyId: strat.id,
      strategyName: strat.name,
    }
  })

  // --- Trade history ------------------------------------------------------
  const tradeCount = 168
  const trades: Trade[] = range(tradeCount)
    .map((i) => {
      const m = pick(rng, markets)
      const outcome: OutcomeSide = rng() > 0.5 ? 'YES' : 'NO'
      const side = rng() > 0.5 ? 'buy' : 'sell'
      const ref = outcome === 'YES' ? m.yesPrice : m.noPrice
      const price = clamp(ref + gaussian(rng, 0, 0.06), 0.02, 0.98)
      const size = round(randFloat(rng, 100, 5200))
      const value = round(size * price)
      const realized = side === 'sell'
      // Win bias ~57%
      const win = rng() < 0.57
      const pnl = realized
        ? round(win ? randFloat(rng, 20, 1400) : -randFloat(rng, 15, 900))
        : null
      const strat = pick(rng, strategies)
      return {
        id: `trd_${10_000 + i}`,
        marketId: m.id,
        question: m.question,
        icon: m.icon,
        category: m.category,
        outcome,
        side,
        price: round(price, 3),
        size,
        value,
        fee: round(value * 0.001, 2),
        pnl,
        realized,
        timestamp: now - randFloat(rng, 0, 30 * DAY),
        strategyId: strat.id,
        strategyName: strat.name,
      } satisfies Trade
    })
    .sort((a, b) => b.timestamp - a.timestamp)

  // --- Equity curve (90d) -------------------------------------------------
  const equityCurve: EquityPoint[] = []
  let eq = initialCapital
  let peak = eq
  for (let i = 89; i >= 0; i--) {
    const drift = 0.004
    const shock = gaussian(rng, 0, 0.016)
    eq = eq * (1 + drift + shock)
    if (i === 45) eq *= 0.93 // a notable drawdown event
    peak = Math.max(peak, eq)
    equityCurve.push({
      t: now - i * DAY,
      equity: round(eq),
      pnl: round(eq - initialCapital),
      drawdown: round(((eq - peak) / peak) * 100, 2),
    })
  }
  const equity = equityCurve[equityCurve.length - 1].equity
  const dayAgo = equityCurve[equityCurve.length - 2].equity

  // --- Portfolio ----------------------------------------------------------
  const positionsValue = round(positions.reduce((s, p) => s + p.value, 0))
  const unrealizedPnl = round(positions.reduce((s, p) => s + p.unrealizedPnl, 0))
  const realizedPnl = round(
    trades.filter((t) => t.pnl !== null).reduce((s, t) => s + (t.pnl ?? 0), 0),
  )
  const balance = round(equity - positionsValue)
  const totalPnl = round(equity - initialCapital)
  const portfolio: PortfolioSnapshot = {
    balance,
    equity,
    positionsValue,
    buyingPower: round(balance * 0.92),
    totalPnl,
    totalPnlPct: round((totalPnl / initialCapital) * 100, 2),
    realizedPnl,
    unrealizedPnl,
    dayPnl: round(equity - dayAgo),
    dayPnlPct: round(((equity - dayAgo) / dayAgo) * 100, 2),
    exposure: round(positionsValue / equity, 4),
  }

  // --- Performance stats --------------------------------------------------
  const realizedTrades = trades.filter((t) => t.pnl !== null)
  const wins = realizedTrades.filter((t) => (t.pnl ?? 0) > 0)
  const losses = realizedTrades.filter((t) => (t.pnl ?? 0) < 0)
  const grossProfit = wins.reduce((s, t) => s + (t.pnl ?? 0), 0)
  const grossLoss = Math.abs(losses.reduce((s, t) => s + (t.pnl ?? 0), 0))
  const avgWin = wins.length ? grossProfit / wins.length : 0
  const avgLoss = losses.length ? grossLoss / losses.length : 0
  const winRate = realizedTrades.length ? wins.length / realizedTrades.length : 0
  const returns = equityCurve.slice(1).map((p, i) => p.equity / equityCurve[i].equity - 1)
  const downside = returns.filter((r) => r < 0)
  const sharpe = stddev(returns) ? (mean(returns) / stddev(returns)) * Math.sqrt(365) : 0
  const sortino = stddev(downside) ? (mean(returns) / stddev(downside)) * Math.sqrt(365) : 0
  const maxDd = Math.min(...equityCurve.map((p) => p.drawdown))
  const performance: PerformanceStats = {
    winRate: round(winRate, 4),
    totalTrades: realizedTrades.length,
    wins: wins.length,
    losses: losses.length,
    avgWin: round(avgWin),
    avgLoss: round(avgLoss),
    profitFactor: round(grossLoss ? grossProfit / grossLoss : grossProfit, 2),
    sharpe: round(sharpe, 2),
    sortino: round(sortino, 2),
    maxDrawdown: round((maxDd / 100) * peak),
    maxDrawdownPct: round(maxDd, 2),
    bestTrade: round(Math.max(...realizedTrades.map((t) => t.pnl ?? 0))),
    worstTrade: round(Math.min(...realizedTrades.map((t) => t.pnl ?? 0))),
    avgHoldHours: round(randFloat(rng, 6, 52), 1),
    expectancy: round(winRate * avgWin - (1 - winRate) * avgLoss),
    roi: round((totalPnl / initialCapital) * 100, 2),
  }

  // --- Activity feed ------------------------------------------------------
  const activity: ActivityEvent[] = buildActivity(rng, trades, strategies, now)

  // --- Risk ---------------------------------------------------------------
  const alerts: RiskAlert[] = [
    { id: randomId('alert'), severity: 'warning', title: 'Concentration warning', message: 'Crypto exposure is 31% of equity, approaching the 35% cap.', timestamp: now - 18 * 60_000, acknowledged: false },
    { id: randomId('alert'), severity: 'critical', title: 'Strategy fault: Whale Tail', message: 'Copy-trading feed disconnected after 4 failed RPC calls. Strategy halted.', timestamp: now - 42 * 60_000, acknowledged: false },
    { id: randomId('alert'), severity: 'info', title: 'Daily loss buffer healthy', message: 'Daily P&L is +2.1%, well within the -5% kill-switch threshold.', timestamp: now - 3 * HOUR, acknowledged: true },
  ]
  const riskLimits: RiskLimit[] = [
    { key: 'dayLoss', label: 'Daily loss limit', description: 'Kill-switch triggers if daily loss exceeds threshold', current: clamp(-portfolio.dayPnlPct, 0, 5), limit: 5, unit: '%', status: portfolio.dayPnl < 0 ? 'warning' : 'ok' },
    { key: 'exposure', label: 'Gross exposure', description: 'Total position value vs equity', current: round(portfolio.exposure * 100, 1), limit: 80, unit: '%', status: portfolio.exposure > 0.7 ? 'warning' : 'ok' },
    { key: 'concentration', label: 'Single-market cap', description: 'Largest position vs equity', current: round((Math.max(...positions.map((p) => p.value)) / equity) * 100, 1), limit: 15, unit: '%', status: 'ok' },
    { key: 'catCrypto', label: 'Crypto category cap', description: 'Crypto exposure vs equity', current: 31, limit: 35, unit: '%', status: 'warning' },
    { key: 'leverage', label: 'Effective leverage', description: 'Notional vs equity', current: 1.2, limit: 2, unit: 'x', status: 'ok' },
    { key: 'openOrders', label: 'Open order count', description: 'Concurrent resting orders', current: orders.length, limit: 50, unit: '', status: 'ok' },
  ]

  // --- Category exposure --------------------------------------------------
  const catMap = new Map<MarketCategory, CategoryExposure>()
  for (const p of positions) {
    const e = catMap.get(p.category) ?? { category: p.category, value: 0, pnl: 0 }
    e.value += p.value
    e.pnl += p.unrealizedPnl
    catMap.set(p.category, e)
  }
  const categoryExposure = [...catMap.values()]
    .map((e) => ({ category: e.category, value: round(e.value), pnl: round(e.pnl) }))
    .sort((a, b) => b.value - a.value)

  // --- Heatmap (day x hour) ----------------------------------------------
  const heatmap: HeatCell[] = []
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      const activeHours = h >= 8 && h <= 22
      const t = randInt(rng, 0, activeHours ? 9 : 2)
      heatmap.push({
        day: d,
        hour: h,
        trades: t,
        pnl: t === 0 ? 0 : round(gaussian(rng, 60, 220)),
      })
    }
  }

  // --- Bot status ---------------------------------------------------------
  const botStatus: BotStatus = {
    online: true,
    mode: 'live',
    connection: 'connected',
    uptimeMs: 6 * DAY + 14 * HOUR + 22 * 60_000,
    latencyMs: randInt(rng, 28, 70),
    startedAt: now - (6 * DAY + 14 * HOUR),
    version: '2.4.1',
    wallet: WALLET,
    network: 'Polygon',
    gasGwei: round(randFloat(rng, 28, 120), 1),
    apiHealth: [
      { name: 'CLOB API', ok: true, latencyMs: randInt(rng, 20, 60) },
      { name: 'Gamma API', ok: true, latencyMs: randInt(rng, 30, 90) },
      { name: 'WebSocket', ok: true, latencyMs: randInt(rng, 8, 30) },
      { name: 'Data feed', ok: true, latencyMs: randInt(rng, 40, 120) },
      { name: 'RPC node', ok: false, latencyMs: randInt(rng, 400, 1200) },
    ],
  }

  return {
    markets,
    strategies,
    positions,
    orders,
    trades,
    equityCurve,
    portfolio,
    performance,
    activity,
    alerts,
    riskLimits,
    categoryExposure,
    heatmap,
    botStatus,
    initialCapital,
  }
}

function buildActivity(
  rng: () => number,
  trades: Trade[],
  strategies: Strategy[],
  now: number,
): ActivityEvent[] {
  const events: ActivityEvent[] = []
  const recent = trades.slice(0, 22)
  for (const t of recent) {
    events.push({
      id: randomId('act'),
      level: 'trade',
      category: 'fill',
      message: `${t.side === 'buy' ? 'Bought' : 'Sold'} ${Math.round(t.size)} ${t.outcome} @ ${(t.price * 100).toFixed(1)}¢`,
      detail: `${t.icon} ${t.question.slice(0, 52)}${t.question.length > 52 ? '…' : ''} · ${t.strategyName}`,
      timestamp: t.timestamp,
      marketId: t.marketId,
    })
  }
  const sysMsgs: Array<{ level: ActivityLevel; category: string; message: string; detail?: string }> = [
    { level: 'signal', category: 'strategy', message: 'Momentum Edge detected a breakout signal', detail: 'Bitcoin $150k market · +6.2% in 4h' },
    { level: 'success', category: 'strategy', message: 'Delta Maker rebalanced inventory', detail: '12 quotes refreshed · net delta 0.03' },
    { level: 'warning', category: 'risk', message: 'Crypto exposure approaching category cap', detail: '31% of 35% limit' },
    { level: 'error', category: 'connection', message: 'RPC node timeout, failed over to backup', detail: 'primary-rpc.polygon · 1180ms' },
    { level: 'info', category: 'system', message: 'Config hot-reloaded', detail: 'Signal Reader conviction 78% → 82%' },
    { level: 'signal', category: 'strategy', message: 'Mean Hunter opened mean-reversion position', detail: 'z-score 2.3 · S&P 7000 market' },
    { level: 'error', category: 'strategy', message: 'Whale Tail halted on feed disconnect', detail: '4 consecutive RPC failures' },
    { level: 'success', category: 'order', message: 'Limit order fully filled', detail: 'NO @ 41.0¢ · Fed July cut' },
    { level: 'info', category: 'system', message: 'Risk engine snapshot persisted', detail: 'exposure 64% · 12 open positions' },
  ]
  sysMsgs.forEach((s, i) => {
    events.push({ id: randomId('act'), ...s, timestamp: now - randInt(rng, 1, 360) * 60_000 - i * 1000 })
  })
  void strategies
  void STRATEGY_NAMES_FALLBACK
  return events.sort((a, b) => b.timestamp - a.timestamp)
}

// ---------------------------------------------------------------------------
// Order book generator — derived deterministically from a market.
// ---------------------------------------------------------------------------
export function generateOrderBook(market: Market, seed?: number): OrderBook {
  const rng = mulberry32(seed ?? market.id.split('_')[1].charCodeAt(0) * 131 + Math.floor(market.yesPrice * 1000))
  const mid = market.yesPrice
  const levels = 12
  const tick = 0.005
  const bids: OrderBookLevel[] = []
  const asks: OrderBookLevel[] = []
  let bidTotal = 0
  let askTotal = 0
  for (let i = 0; i < levels; i++) {
    const bidPrice = round(mid - market.spread / 2 - i * tick, 4)
    const askPrice = round(mid + market.spread / 2 + i * tick, 4)
    const bidSize = round(randFloat(rng, 200, 5000) * (1 + i * 0.15))
    const askSize = round(randFloat(rng, 200, 5000) * (1 + i * 0.15))
    bidTotal += bidSize
    askTotal += askSize
    if (bidPrice > 0.001) bids.push({ price: bidPrice, size: bidSize, total: round(bidTotal) })
    if (askPrice < 0.999) asks.push({ price: askPrice, size: askSize, total: round(askTotal) })
  }
  return {
    marketId: market.id,
    bids,
    asks,
    spread: round(market.spread, 4),
    midpoint: round(mid, 4),
  }
}
