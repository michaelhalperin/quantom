import type { TrackedMarket, TokenBook } from './types'
import { getMarkets, getBook, getPriceHistory } from './polymarket/client'
import { toTracked, toTokenBook } from './polymarket/map'
import { getConfig } from './config'
import { log } from './log'

const HISTORY_STEP_MS = 5 * 60_000 // append an observed price at most this often
const HISTORY_CAP = 300

/** Owns the live, in-memory view of tradeable markets and their price history. */
export class MarketCache {
  private map = new Map<string, TrackedMarket>()
  private lastHistoryAt = new Map<string, number>()
  private backfilled = new Set<string>()
  lastRefresh = 0

  list(): TrackedMarket[] {
    return [...this.map.values()]
  }
  get(id: string): TrackedMarket | undefined {
    return this.map.get(id)
  }

  /** Pull the active universe from Gamma, filter, and merge into the cache. */
  async refresh(): Promise<void> {
    const cfg = getConfig()
    const raw = await getMarkets(Math.max(150, cfg.universe.maxMarkets * 3))
    if (!raw.length) return

    const mapped: TrackedMarket[] = []
    for (const r of raw) {
      const t = toTracked(r)
      if (!t) continue
      const m = t.market
      const tradeable =
        m.status !== 'resolved' &&
        m.liquidity >= cfg.universe.minLiquidity &&
        m.volume24h >= cfg.universe.minVolume24h
      // Keep resolved markets we still hold history/positions for, plus the
      // tradeable universe up to the cap.
      if (tradeable || this.map.has(m.id)) mapped.push(t)
    }

    mapped.sort((a, b) => b.market.volume24h - a.market.volume24h)
    const keep = mapped.slice(0, cfg.universe.maxMarkets)
    const now = Date.now()
    const nextIds = new Set(keep.map((t) => t.market.id))

    for (const t of keep) {
      const prev = this.map.get(t.market.id)
      // carry forward accumulated history
      t.history = prev?.history ?? []
      this.appendHistory(t, now)
      // keep the display copy in sync even when the append was throttled
      t.market.history = t.history
      this.map.set(t.market.id, t)
      if (!this.backfilled.has(t.market.id)) {
        this.backfilled.add(t.market.id)
        void this.backfill(t)
      }
    }

    // Drop markets that fell out of the universe and we don't hold history for.
    for (const id of [...this.map.keys()]) {
      if (!nextIds.has(id) && !this.map.get(id)!.history.length) this.map.delete(id)
    }

    this.lastRefresh = now
    log.debug(`markets refreshed: ${this.map.size} tracked`)
  }

  private appendHistory(t: TrackedMarket, now: number): void {
    const last = this.lastHistoryAt.get(t.market.id) ?? 0
    if (now - last < HISTORY_STEP_MS && t.history.length) return
    t.history.push({ t: now, p: t.market.yesPrice })
    if (t.history.length > HISTORY_CAP) t.history.splice(0, t.history.length - HISTORY_CAP)
    t.market.history = t.history
    this.lastHistoryAt.set(t.market.id, now)
  }

  /** One-time best-effort backfill of real historical prices for the chart. */
  private async backfill(t: TrackedMarket): Promise<void> {
    const points = await getPriceHistory(t.yesTokenId, '1w', 180)
    if (!points.length) return
    const cur = this.map.get(t.market.id)
    if (!cur) return
    const observedFrom = cur.history[0]?.t ?? Infinity
    const merged = [...points.filter((p) => p.t < observedFrom), ...cur.history]
    cur.history = merged.slice(-HISTORY_CAP)
    cur.market.history = cur.history
  }

  /** Live YES/NO token books for a market (network call). */
  async books(id: string): Promise<{ yes: TokenBook | null; no: TokenBook | null }> {
    const t = this.map.get(id)
    if (!t) return { yes: null, no: null }
    const [yesRaw, noRaw] = await Promise.all([getBook(t.yesTokenId), getBook(t.noTokenId)])
    return {
      yes: yesRaw ? toTokenBook(t.yesTokenId, yesRaw) : null,
      no: noRaw ? toTokenBook(t.noTokenId, noRaw) : null,
    }
  }

  async yesBook(id: string): Promise<TokenBook | null> {
    const t = this.map.get(id)
    if (!t) return null
    const raw = await getBook(t.yesTokenId)
    return raw ? toTokenBook(t.yesTokenId, raw) : null
  }
}
