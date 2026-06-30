// Re-export the dashboard's domain model so the backend is built against the
// exact same contract the UI consumes. These are type-only and erased at
// runtime, so the relative path to the frontend source never needs to resolve
// at execution time.
export type * from '../../src/types'
import type {
  Market,
  OutcomeSide,
  OrderSide,
  OrderType,
  Strategy,
  StrategyKind,
  Position,
  Order,
  Trade,
  ActivityEvent,
  RiskAlert,
  EquityPoint,
  PortfolioSnapshot,
  PerformanceStats,
  RiskLimit,
  CategoryExposure,
  HeatCell,
  BotStatus,
} from '../../src/types'

// ---------------------------------------------------------------------------
// The full snapshot the dashboard's getSnapshot() must return. Mirrors
// `MockData` in the frontend (src/data/mock.ts) field-for-field.
// ---------------------------------------------------------------------------
export interface Snapshot {
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

// ---------------------------------------------------------------------------
// Server-only types (never sent verbatim to the UI).
// ---------------------------------------------------------------------------

/** A live market plus the private fields the engine needs (CLOB token ids). */
export interface TrackedMarket {
  market: Market
  yesTokenId: string
  noTokenId: string
  conditionId: string
  tickSize: number
  minOrderSize: number
  /** Rolling YES-price history we observe, used for the value model + charts. */
  history: { t: number; p: number }[]
  resolved: boolean
  /** Resolved YES payout: 1 if YES won, 0 if NO won, null if unknown/open. */
  resolvedYes: number | null
}

export interface BookLevelRaw {
  price: number
  size: number
}

/** Normalised order book for one CLOB token (best-first). */
export interface TokenBook {
  tokenId: string
  bids: BookLevelRaw[] // descending price (best bid first)
  asks: BookLevelRaw[] // ascending price (best ask first)
}

export interface PlaceOrderInput {
  marketId: string
  outcome: OutcomeSide
  side: OrderSide
  type: OrderType
  price: number
  size: number
  strategyId?: string
  strategyName?: string
}

/** A trade intent produced by a strategy before risk sizing/execution. */
export interface TradeIntent {
  marketId: string
  outcome: OutcomeSide
  side: OrderSide
  /** Limit/expected price (probability 0–1). */
  price: number
  /** Our estimated fair value for the chosen side (probability 0–1). */
  fair: number
  /** Edge in probability points the strategy is acting on. */
  edge: number
  strategyId: string
  strategyName: string
  reason: string
}

export interface StrategyDef {
  id: string
  name: string
  kind: StrategyKind
  description: string
}
