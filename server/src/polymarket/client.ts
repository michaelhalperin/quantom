import { log } from '../log'
import { pool } from '../util'

const GAMMA = 'https://gamma-api.polymarket.com'
const CLOB = 'https://clob.polymarket.com'

// Raw shapes (only the fields we consume) from Polymarket's public APIs.
export interface GammaMarket {
  id: string
  question: string
  slug: string
  conditionId: string
  description?: string
  outcomes?: string // JSON string e.g. '["Yes","No"]'
  outcomePrices?: string // JSON string e.g. '["0.62","0.38"]'
  clobTokenIds?: string // JSON string [yesId, noId]
  endDate?: string
  startDate?: string
  createdAt?: string
  spread?: number
  bestBid?: number
  bestAsk?: number
  lastTradePrice?: number
  oneDayPriceChange?: number
  volume24hr?: number
  volumeNum?: number
  liquidityNum?: number
  orderPriceMinTickSize?: number
  orderMinSize?: number
  enableOrderBook?: boolean
  acceptingOrders?: boolean
  active?: boolean
  closed?: boolean
  negRisk?: boolean
  events?: { title?: string; tags?: { label?: string; slug?: string }[] }[]
}

export interface RawBook {
  asset_id?: string
  bids?: { price: string; size: string }[]
  asks?: { price: string; size: string }[]
  tick_size?: string
}

export interface RawHistory {
  history?: { t: number; p: number }[]
}

const latency: Record<string, number> = { gamma: 0, clob: 0 }
const ok: Record<string, boolean> = { gamma: true, clob: true }

export function apiHealth() {
  return {
    gamma: { latencyMs: Math.round(latency.gamma), ok: ok.gamma },
    clob: { latencyMs: Math.round(latency.clob), ok: ok.clob },
  }
}

async function fetchJson<T>(url: string, tag: 'gamma' | 'clob', timeoutMs = 12_000): Promise<T> {
  let lastErr: unknown
  for (let attempt = 0; attempt < 2; attempt++) {
    const started = Date.now()
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: { accept: 'application/json' },
      })
      latency[tag] = Date.now() - started
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      ok[tag] = true
      return (await res.json()) as T
    } catch (err) {
      lastErr = err
      latency[tag] = Date.now() - started
      if (attempt === 0) await new Promise((r) => setTimeout(r, 350))
    }
  }
  ok[tag] = false
  throw lastErr
}

/** Most active open markets, ordered by 24h volume. */
export async function getMarkets(limit = 150): Promise<GammaMarket[]> {
  const url = `${GAMMA}/markets?closed=false&active=true&limit=${limit}&order=volume24hr&ascending=false`
  try {
    return await fetchJson<GammaMarket[]>(url, 'gamma')
  } catch (err) {
    log.warn('getMarkets failed', (err as Error).message)
    return []
  }
}

/** Live order book for one CLOB token. */
export async function getBook(tokenId: string): Promise<RawBook | null> {
  try {
    return await fetchJson<RawBook>(`${CLOB}/book?token_id=${tokenId}`, 'clob', 8_000)
  } catch {
    return null
  }
}

/** Fetch many books with bounded concurrency. */
export async function getBooks(tokenIds: string[]): Promise<Map<string, RawBook>> {
  const out = new Map<string, RawBook>()
  const books = await pool(tokenIds, 6, (t) => getBook(t))
  tokenIds.forEach((t, i) => {
    const b = books[i]
    if (b) out.set(t, b)
  })
  return out
}

/** Best-effort historical price series for a token (used to seed charts). */
export async function getPriceHistory(
  tokenId: string,
  interval = '1w',
  fidelity = 180,
): Promise<{ t: number; p: number }[]> {
  try {
    const url = `${CLOB}/prices-history?market=${tokenId}&interval=${interval}&fidelity=${fidelity}`
    const data = await fetchJson<RawHistory>(url, 'clob', 8_000)
    return (data.history ?? []).map((h) => ({ t: h.t * 1000, p: h.p }))
  } catch {
    return []
  }
}
