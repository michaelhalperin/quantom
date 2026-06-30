import type { StrategyDef, TradeIntent, TrackedMarket, TokenBook } from '../types'
import type { Config } from '../config'
import { mean, round } from '../util'

export const STRATEGY_DEFS: StrategyDef[] = [
  {
    id: 'strat_arb',
    name: 'Arb Scout',
    kind: 'arbitrage',
    description:
      'Riskless arbitrage: in a Yes/No market one YES + one NO always pay exactly $1 at resolution. When both sides can be bought for less than $1 (after fees), the profit is locked in. Rare, but genuinely edge-positive.',
  },
  {
    id: 'strat_value',
    name: 'Mean Reversion',
    kind: 'mean-reversion',
    description:
      'Fades short-term deviations from a rolling reference price back toward fair value. This signal has no proven long-run edge — its purpose is to be measured in paper, not trusted. Conservatively sized.',
  },
]

export interface ArbOpportunity {
  market: TrackedMarket
  shares: number
  askYes: number
  askNo: number
  profitPerShare: number
}

/**
 * Detect a riskless YES+NO arbitrage from live books. We only use the top of
 * each book so the quoted prices are actually available for both legs.
 */
export function findArb(
  t: TrackedMarket,
  yes: TokenBook | null,
  no: TokenBook | null,
  cfg: Config,
): ArbOpportunity | null {
  if (!cfg.strategy.enableArbitrage) return null
  const ay = yes?.asks[0]
  const an = no?.asks[0]
  if (!ay || !an) return null
  const fee = cfg.risk.feeBps / 10_000
  const cost = ay.price + an.price
  const profitPerShare = 1 - cost - cost * fee
  if (profitPerShare < cfg.strategy.arbMinProfit) return null
  const shares = round(Math.min(ay.size, an.size), 2)
  if (shares <= 0) return null
  return { market: t, shares, askYes: ay.price, askNo: an.price, profitPerShare: round(profitPerShare, 4) }
}

/**
 * Mean-reversion value signal. Compares the current YES price to the average of
 * the pre-move window; if it has deviated more than `valueMinEdge`, bet on
 * reversion (buy the cheap side). Returns null when there's no clean signal.
 */
export function findValue(t: TrackedMarket, cfg: Config): TradeIntent | null {
  if (!cfg.strategy.enableValue) return null
  if (t.resolved || t.market.status !== 'active') return null
  const hist = t.history
  if (hist.length < 8) return null

  const n = Math.min(cfg.strategy.valueLookback, hist.length)
  const window = hist.slice(-n)
  // Baseline excludes the two most recent points so a fresh move reads as a deviation.
  const baseline = window.slice(0, Math.max(1, window.length - 2)).map((h) => h.p)
  const fair = mean(baseline)
  const yesPrice = t.market.yesPrice
  const dev = fair - yesPrice
  const def = STRATEGY_DEFS[1]

  if (dev > cfg.strategy.valueMinEdge) {
    // YES looks cheap vs baseline -> buy YES.
    return {
      marketId: t.market.id,
      outcome: 'YES',
      side: 'buy',
      price: t.market.bestAsk || yesPrice,
      fair: round(fair, 4),
      edge: round(dev, 4),
      strategyId: def.id,
      strategyName: def.name,
      reason: `YES ${(yesPrice * 100).toFixed(0)}¢ vs baseline ${(fair * 100).toFixed(0)}¢`,
    }
  }
  if (-dev > cfg.strategy.valueMinEdge) {
    // YES looks rich -> buy NO (its mirror).
    const fairNo = round(1 - fair, 4)
    return {
      marketId: t.market.id,
      outcome: 'NO',
      side: 'buy',
      price: round(1 - (t.market.bestBid || yesPrice), 4),
      fair: fairNo,
      edge: round(-dev, 4),
      strategyId: def.id,
      strategyName: def.name,
      reason: `YES ${(yesPrice * 100).toFixed(0)}¢ vs baseline ${(fair * 100).toFixed(0)}¢ (buy NO)`,
    }
  }
  return null
}
