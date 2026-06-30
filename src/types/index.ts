// ---------------------------------------------------------------------------
// Domain model for a Polymarket trading bot dashboard.
// All money values are USD; all prices are probabilities in [0, 1].
// ---------------------------------------------------------------------------

export type MarketCategory =
  | 'Politics'
  | 'Crypto'
  | 'Sports'
  | 'Economics'
  | 'Tech'
  | 'Pop Culture'
  | 'Geopolitics'
  | 'Science'

export const MARKET_CATEGORIES: MarketCategory[] = [
  'Politics',
  'Crypto',
  'Sports',
  'Economics',
  'Tech',
  'Pop Culture',
  'Geopolitics',
  'Science',
]

export type OutcomeSide = 'YES' | 'NO'
export type MarketStatus = 'active' | 'closing-soon' | 'resolved' | 'paused'

export interface PricePoint {
  t: number // timestamp (ms)
  p: number // YES price (probability 0–1)
}

export interface Market {
  id: string
  slug: string
  question: string
  category: MarketCategory
  status: MarketStatus
  icon: string // emoji
  yesPrice: number
  noPrice: number
  prevYesPrice: number
  change24h: number // percentage points
  volume24h: number
  volumeTotal: number
  liquidity: number
  openInterest: number
  endDate: number
  createdAt: number
  spread: number
  bestBid: number
  bestAsk: number
  history: PricePoint[]
  tags: string[]
  traders: number
  botActive: boolean // bot is currently trading this market
}

export interface Position {
  id: string
  marketId: string
  question: string
  category: MarketCategory
  icon: string
  side: OutcomeSide
  shares: number
  avgPrice: number
  currentPrice: number
  costBasis: number
  value: number
  unrealizedPnl: number
  unrealizedPnlPct: number
  realizedPnl: number
  openedAt: number
  strategyId: string
  strategyName: string
}

export type OrderSide = 'buy' | 'sell'
export type OrderType = 'limit' | 'market'
export type OrderStatus = 'open' | 'filled' | 'partial' | 'cancelled' | 'rejected'
export type TimeInForce = 'GTC' | 'IOC' | 'FOK' | 'GTD'

export interface Order {
  id: string
  marketId: string
  question: string
  icon: string
  outcome: OutcomeSide
  side: OrderSide
  type: OrderType
  price: number
  size: number
  filled: number
  status: OrderStatus
  tif: TimeInForce
  createdAt: number
  updatedAt: number
  strategyId: string
  strategyName: string
}

export interface Trade {
  id: string
  marketId: string
  question: string
  icon: string
  category: MarketCategory
  outcome: OutcomeSide
  side: OrderSide
  price: number
  size: number
  value: number
  fee: number
  pnl: number | null // realized P&L for closing trades
  realized: boolean
  timestamp: number
  strategyId: string
  strategyName: string
}

export interface OrderBookLevel {
  price: number
  size: number
  total: number
}

export interface OrderBook {
  marketId: string
  bids: OrderBookLevel[]
  asks: OrderBookLevel[]
  spread: number
  midpoint: number
}

export type StrategyKind =
  | 'market-making'
  | 'momentum'
  | 'mean-reversion'
  | 'arbitrage'
  | 'news-sentiment'
  | 'copy-trading'

export type StrategyStatus = 'running' | 'paused' | 'stopped' | 'error'

export interface StrategyParam {
  key: string
  label: string
  value: number
  min: number
  max: number
  step: number
  unit?: string
}

export interface Strategy {
  id: string
  name: string
  kind: StrategyKind
  status: StrategyStatus
  description: string
  allocation: number
  pnl: number
  pnl7d: number
  winRate: number
  trades: number
  sharpe: number
  maxDrawdown: number
  markets: number
  params: StrategyParam[]
  equity: PricePoint[]
  createdAt: number
  lastSignal: number
}

export type BotConnection = 'connected' | 'degraded' | 'disconnected'
export type BotMode = 'live' | 'paper' | 'idle'

export interface ApiHealth {
  name: string
  ok: boolean
  latencyMs: number
}

export interface BotStatus {
  online: boolean
  mode: BotMode
  connection: BotConnection
  uptimeMs: number
  latencyMs: number
  startedAt: number
  version: string
  wallet: string
  network: string
  gasGwei: number
  apiHealth: ApiHealth[]
}

export interface PortfolioSnapshot {
  balance: number
  equity: number
  positionsValue: number
  buyingPower: number
  totalPnl: number
  totalPnlPct: number
  realizedPnl: number
  unrealizedPnl: number
  dayPnl: number
  dayPnlPct: number
  exposure: number // fraction of equity deployed in positions
}

export interface PerformanceStats {
  winRate: number
  totalTrades: number
  wins: number
  losses: number
  avgWin: number
  avgLoss: number
  profitFactor: number
  sharpe: number
  sortino: number
  maxDrawdown: number
  maxDrawdownPct: number
  bestTrade: number
  worstTrade: number
  avgHoldHours: number
  expectancy: number
  roi: number
}

export type ActivityLevel = 'info' | 'success' | 'warning' | 'error' | 'trade' | 'signal'

export interface ActivityEvent {
  id: string
  level: ActivityLevel
  category: string
  message: string
  detail?: string
  timestamp: number
  marketId?: string
}

export type AlertSeverity = 'critical' | 'warning' | 'info'

export interface RiskAlert {
  id: string
  severity: AlertSeverity
  title: string
  message: string
  timestamp: number
  acknowledged: boolean
}

export type LimitStatus = 'ok' | 'warning' | 'breach'

export interface RiskLimit {
  key: string
  label: string
  description: string
  current: number
  limit: number
  unit: string
  status: LimitStatus
}

export interface EquityPoint {
  t: number
  equity: number
  pnl: number
  drawdown: number // negative or zero
}

export interface CategoryExposure {
  category: MarketCategory
  value: number
  pnl: number
}

export interface HeatCell {
  day: number // 0–6 (Mon–Sun)
  hour: number // 0–23
  pnl: number
  trades: number
}
