import type { DB, PositionRow } from '../db'
import type { MarketCache } from '../markets'
import type {
  ActivityEvent,
  ActivityLevel,
  OutcomeSide,
  Trade,
  TokenBook,
  TrackedMarket,
  PlaceOrderInput,
} from '../types'
import { getConfig } from '../config'
import { id, round } from '../util'
import { log } from '../log'

interface FillResult {
  shares: number
  cash: number // cost for buys, proceeds for sells
  avg: number
}

/** Walk one side of a book, respecting an optional limit price. */
function walk(
  levels: { price: number; size: number }[],
  maxShares: number,
  isBuy: boolean,
  limit?: number,
): FillResult {
  let shares = 0
  let cash = 0
  for (const lvl of levels) {
    if (limit != null) {
      if (isBuy && lvl.price > limit + 1e-9) break
      if (!isBuy && lvl.price < limit - 1e-9) break
    }
    const take = Math.min(lvl.size, maxShares - shares)
    if (take <= 0) break
    shares += take
    cash += take * lvl.price
    if (shares >= maxShares - 1e-9) break
  }
  return { shares: round(shares, 2), cash, avg: shares ? cash / shares : 0 }
}

/** The paper broker: executes virtual fills against live books and keeps the
 *  bankroll, positions, and trade log honest. It never touches a real wallet. */
export class Broker {
  constructor(
    private db: DB,
    private cache: MarketCache,
  ) {}

  balance(): number {
    return this.db.getNum('balance', getConfig().bot.initialCapital)
  }
  private setBalance(v: number): void {
    this.db.setNum('balance', round(v, 2))
  }

  private feeOn(notional: number): number {
    return round((notional * getConfig().risk.feeBps) / 10_000, 4)
  }

  emit(level: ActivityLevel, category: string, message: string, detail?: string, marketId?: string): void {
    const evt: ActivityEvent = {
      id: id('act'),
      level,
      category,
      message,
      detail,
      timestamp: Date.now(),
      marketId,
    }
    this.db.insertActivity(evt)
  }

  private bookFor(outcome: OutcomeSide, books: { yes: TokenBook | null; no: TokenBook | null }): TokenBook | null {
    return outcome === 'YES' ? books.yes : books.no
  }

  /**
   * Buy `targetShares` of an outcome at market, walking the live book. Returns
   * the executed trade, or null if nothing filled (no book / no liquidity /
   * limit not marketable / insufficient balance).
   */
  buy(
    t: TrackedMarket,
    outcome: OutcomeSide,
    targetShares: number,
    book: TokenBook | null,
    strategyId: string,
    strategyName: string,
    limit?: number,
  ): Trade | null {
    if (!book || !book.asks.length || targetShares <= 0) return null
    const fill = walk(book.asks, targetShares, true, limit)
    if (fill.shares <= 0) return null

    let cost = fill.cash
    let shares = fill.shares
    let fee = this.feeOn(cost)
    const bal = this.balance()
    if (cost + fee > bal) {
      // Scale down to what we can afford.
      const affordable = bal / (1 + getConfig().risk.feeBps / 10_000)
      if (affordable < fill.avg * 1) return null
      const scaled = walk(book.asks, affordable / fill.avg, true, limit)
      if (scaled.shares <= 0 || scaled.cash > bal) return null
      shares = scaled.shares
      cost = scaled.cash
      fee = this.feeOn(cost)
    }

    this.setBalance(bal - cost - fee)
    this.addToPosition(t, outcome, shares, cost, strategyId, strategyName)

    const price = round(cost / shares, 4)
    const trade: Trade = {
      id: id('trd'),
      marketId: t.market.id,
      question: t.market.question,
      icon: t.market.icon,
      category: t.market.category,
      outcome,
      side: 'buy',
      price,
      size: round(shares),
      value: round(cost),
      fee,
      pnl: null,
      realized: false,
      timestamp: Date.now(),
      strategyId,
      strategyName,
    }
    this.db.insertTrade(trade)
    this.emit(
      'trade',
      'fill',
      `Bought ${Math.round(shares)} ${outcome} @ ${(price * 100).toFixed(1)}¢`,
      `${t.market.icon} ${t.market.question.slice(0, 52)} · ${strategyName}`,
      t.market.id,
    )
    return trade
  }

  private addToPosition(
    t: TrackedMarket,
    side: OutcomeSide,
    shares: number,
    cost: number,
    strategyId: string,
    strategyName: string,
  ): void {
    const existing = this.db.positionFor(t.market.id, side)
    if (existing) {
      const newShares = round(existing.shares + shares, 2)
      const newCost = round(existing.costBasis + cost, 2)
      this.db.upsertPosition({
        ...existing,
        shares: newShares,
        costBasis: newCost,
        avgPrice: round(newCost / newShares, 4),
      })
    } else {
      this.db.upsertPosition({
        id: id('pos'),
        marketId: t.market.id,
        question: t.market.question,
        category: t.market.category,
        icon: t.market.icon,
        side,
        shares: round(shares, 2),
        avgPrice: round(cost / shares, 4),
        costBasis: round(cost, 2),
        realizedPnl: 0,
        openedAt: Date.now(),
        strategyId,
        strategyName,
      })
    }
  }

  /**
   * Sell `shares` of an existing position at market (walking the bid side).
   * Used for take-profit, stop-loss, and manual/closing actions. Returns the
   * realized trade or null.
   */
  sell(
    pos: PositionRow,
    shares: number,
    book: TokenBook | null,
    reason: string,
  ): Trade | null {
    if (!book || !book.bids.length) return null
    const qty = Math.min(shares, pos.shares)
    if (qty <= 0) return null
    const fill = walk(book.bids, qty, false)
    if (fill.shares <= 0) return null

    const proceeds = fill.cash
    const fee = this.feeOn(proceeds)
    const sold = fill.shares
    const costOfSold = round((pos.costBasis / pos.shares) * sold, 4)
    const pnl = round(proceeds - fee - costOfSold, 2)

    this.setBalance(this.balance() + proceeds - fee)

    const remaining = round(pos.shares - sold, 2)
    if (remaining <= 0.01) {
      this.db.deletePosition(pos.id)
    } else {
      this.db.upsertPosition({
        ...pos,
        shares: remaining,
        costBasis: round(pos.costBasis - costOfSold, 2),
        realizedPnl: round(pos.realizedPnl + pnl, 2),
      })
    }

    const price = round(proceeds / sold, 4)
    const trade: Trade = {
      id: id('trd'),
      marketId: pos.marketId,
      question: pos.question,
      icon: pos.icon,
      category: pos.category,
      outcome: pos.side,
      side: 'sell',
      price,
      size: round(sold),
      value: round(proceeds),
      fee,
      pnl,
      realized: true,
      timestamp: Date.now(),
      strategyId: pos.strategyId,
      strategyName: pos.strategyName,
    }
    this.db.insertTrade(trade)
    this.emit(
      pnl >= 0 ? 'success' : 'warning',
      'fill',
      `Closed ${Math.round(sold)} ${pos.side} · ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(0)} (${reason})`,
      `${pos.icon} ${pos.question.slice(0, 52)}`,
      pos.marketId,
    )
    return trade
  }

  /** Close an entire position at market. */
  async closePosition(positionId: string): Promise<Trade | null> {
    const pos = this.db.positions().find((p) => p.id === positionId)
    if (!pos) return null
    const book = await this.cache.books(pos.marketId)
    return this.sell(pos, pos.shares, this.bookFor(pos.side, book), 'manual close')
  }

  /** Settle every position in a market that has resolved. */
  settle(t: TrackedMarket): void {
    if (!t.resolved || t.resolvedYes === null) return
    for (const pos of this.db.positions().filter((p) => p.marketId === t.market.id)) {
      const won = (pos.side === 'YES' && t.resolvedYes === 1) || (pos.side === 'NO' && t.resolvedYes === 0)
      const payout = won ? round(pos.shares, 2) : 0
      const pnl = round(payout - pos.costBasis, 2)
      this.setBalance(this.balance() + payout)
      this.db.deletePosition(pos.id)
      this.db.insertTrade({
        id: id('trd'),
        marketId: pos.marketId,
        question: pos.question,
        icon: pos.icon,
        category: pos.category,
        outcome: pos.side,
        side: 'sell',
        price: won ? 1 : 0,
        size: round(pos.shares),
        value: payout,
        fee: 0,
        pnl,
        realized: true,
        timestamp: Date.now(),
        strategyId: pos.strategyId,
        strategyName: pos.strategyName,
      })
      this.emit(
        won ? 'success' : 'warning',
        'settlement',
        `Market resolved ${t.resolvedYes === 1 ? 'YES' : 'NO'} · ${pos.side} ${won ? 'won' : 'lost'} ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(0)}`,
        `${pos.icon} ${pos.question.slice(0, 52)}`,
        pos.marketId,
      )
      log.info(`settled ${pos.side} ${pos.marketId}: ${pnl >= 0 ? '+' : ''}${pnl}`)
    }
  }

  /**
   * Handle a manual order from the dashboard. Market orders and marketable
   * limit orders execute immediately; non-marketable limits rest as open
   * orders and are checked each manage cycle. Sells only reduce an existing
   * position (no naked shorting — you'd buy the opposite outcome instead).
   */
  async placeManual(input: PlaceOrderInput): Promise<{ ok: boolean; reason?: string }> {
    const t = this.cache.get(input.marketId)
    if (!t) return { ok: false, reason: 'unknown market' }
    const books = await this.cache.books(input.marketId)
    const book = this.bookFor(input.outcome, books)

    if (input.side === 'buy') {
      const marketable = input.type === 'market' || (book?.asks[0]?.price ?? 1) <= input.price + 1e-9
      if (marketable) {
        const trade = this.buy(
          t,
          input.outcome,
          input.size,
          book,
          'manual',
          'Manual',
          input.type === 'limit' ? input.price : undefined,
        )
        return trade ? { ok: true } : { ok: false, reason: 'no liquidity at price' }
      }
      this.restOrder(input)
      return { ok: true }
    }

    // sell -> close/reduce matching position
    const pos = this.db.positionFor(input.marketId, input.outcome)
    if (!pos) return { ok: false, reason: 'no position to sell (cannot short)' }
    const marketable = input.type === 'market' || (book?.bids[0]?.price ?? 0) >= input.price - 1e-9
    if (marketable) {
      const trade = this.sell(pos, input.size, book, 'manual')
      return trade ? { ok: true } : { ok: false, reason: 'no bid liquidity at price' }
    }
    this.restOrder(input)
    return { ok: true }
  }

  private restOrder(input: PlaceOrderInput): void {
    const t = this.cache.get(input.marketId)!
    this.db.insertOrder({
      id: id('ord'),
      marketId: input.marketId,
      question: t.market.question,
      icon: t.market.icon,
      outcome: input.outcome,
      side: input.side,
      type: input.type,
      price: round(input.price, 3),
      size: round(input.size),
      filled: 0,
      status: 'open',
      tif: 'GTC',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      strategyId: input.strategyId ?? 'manual',
      strategyName: input.strategyName ?? 'Manual',
    })
    this.emit(
      'info',
      'order',
      `Placed ${input.type} ${input.side} ${Math.round(input.size)} ${input.outcome} @ ${(input.price * 100).toFixed(1)}¢`,
      `${t.market.icon} ${t.market.question.slice(0, 52)}`,
      input.marketId,
    )
  }

  /** Try to fill resting limit orders against current books. */
  async workOpenOrders(): Promise<void> {
    for (const o of this.db.openOrders()) {
      const t = this.cache.get(o.marketId)
      if (!t) continue
      const books = await this.cache.books(o.marketId)
      const book = this.bookFor(o.outcome, books)
      if (!book) continue
      const remaining = o.size - o.filled
      if (remaining <= 0) continue

      if (o.side === 'buy' && (book.asks[0]?.price ?? 1) <= o.price + 1e-9) {
        const trade = this.buy(t, o.outcome, remaining, book, o.strategyId, o.strategyName, o.price)
        if (trade) this.db.updateOrder(o.id, round(o.filled + trade.size), o.filled + trade.size >= o.size ? 'filled' : 'partial')
      } else if (o.side === 'sell') {
        const pos = this.db.positionFor(o.marketId, o.outcome)
        if (pos && (book.bids[0]?.price ?? 0) >= o.price - 1e-9) {
          const trade = this.sell(pos, remaining, book, 'limit')
          if (trade) this.db.updateOrder(o.id, round(o.filled + trade.size), o.filled + trade.size >= o.size ? 'filled' : 'partial')
        }
      }
    }
  }

  cancelOrder(orderId: string): void {
    const o = this.db.getOrder(orderId)
    if (!o) return
    this.db.updateOrder(orderId, o.filled, 'cancelled')
    this.emit('warning', 'order', 'Order cancelled', `${o.icon} ${o.question.slice(0, 52)}`, o.marketId)
  }
}
