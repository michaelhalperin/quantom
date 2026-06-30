import type { DB } from './db'
import type { MarketCache } from './markets'
import type { Position, MarketCategory } from './types'
import { round } from './util'

export interface Marked {
  positions: Position[]
  positionsValue: number
  unrealizedPnl: number
  byCategory: Map<MarketCategory, { value: number; pnl: number }>
}

/** Mark every open position to the current market price (single source of
 *  truth shared by the trading loop and the snapshot endpoint). */
export function markPositions(db: DB, cache: MarketCache): Marked {
  const positions: Position[] = []
  const byCategory = new Map<MarketCategory, { value: number; pnl: number }>()
  let positionsValue = 0
  let unrealizedPnl = 0

  for (const row of db.positions()) {
    const t = cache.get(row.marketId)
    // If the market dropped out of the cache, fall back to entry price so the
    // position is neither magically profitable nor wiped out.
    const currentPrice = t
      ? row.side === 'YES'
        ? t.market.yesPrice
        : t.market.noPrice
      : row.avgPrice
    const value = round(row.shares * currentPrice)
    const uPnl = round(value - row.costBasis)
    positionsValue += value
    unrealizedPnl += uPnl

    const c = byCategory.get(row.category) ?? { value: 0, pnl: 0 }
    c.value += value
    c.pnl += uPnl
    byCategory.set(row.category, c)

    positions.push({
      id: row.id,
      marketId: row.marketId,
      question: row.question,
      category: row.category,
      icon: row.icon,
      side: row.side,
      shares: row.shares,
      avgPrice: row.avgPrice,
      currentPrice: round(currentPrice, 4),
      costBasis: row.costBasis,
      value,
      unrealizedPnl: uPnl,
      unrealizedPnlPct: row.costBasis ? round((uPnl / row.costBasis) * 100, 2) : 0,
      realizedPnl: round(row.realizedPnl, 2),
      openedAt: row.openedAt,
      strategyId: row.strategyId,
      strategyName: row.strategyName,
    })
  }

  return {
    positions,
    positionsValue: round(positionsValue),
    unrealizedPnl: round(unrealizedPnl),
    byCategory,
  }
}
