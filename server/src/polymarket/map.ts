import type { Market, MarketCategory, MarketStatus, OrderBook, OrderBookLevel } from '../types'
import type { TrackedMarket, TokenBook } from '../types'
import type { GammaMarket, RawBook } from './client'
import { clamp, round, DAY } from '../util'

function parseJsonArray(s: string | undefined): string[] {
  if (!s) return []
  try {
    const v = JSON.parse(s)
    return Array.isArray(v) ? v.map(String) : []
  } catch {
    return []
  }
}

// --- category classification ------------------------------------------------
const CATEGORY_KEYWORDS: [MarketCategory, RegExp][] = [
  ['Crypto', /\b(bitcoin|btc|ethereum|eth|solana|sol|crypto|dogecoin|doge|xrp|ripple|altcoin|stablecoin|memecoin|nft|defi|token|halving)\b/i],
  ['Sports', /\b(nba|nfl|mlb|nhl|soccer|football|basketball|baseball|tennis|golf|ufc|boxing|olympic|world cup|champions league|premier league|super bowl|playoffs?|finals?|cup|match|game|win the|defeat)\b/i],
  ['Politics', /\b(president|election|senate|congress|house|governor|primary|democrat|republican|gop|vote|poll|impeach|nominee|cabinet|midterm|parliament|shutdown)\b/i],
  ['Geopolitics', /\b(ukraine|russia|china|taiwan|israel|gaza|iran|nato|war|ceasefire|sanction|invasion|nuclear|missile|north korea|venezuela)\b/i],
  ['Economics', /\b(fed|interest rate|inflation|cpi|recession|gdp|unemployment|s&p|nasdaq|dow|stock|oil|crude|wti|gold|treasury|fomc|jobs report|rate cut|rate hike)\b/i],
  ['Tech', /\b(openai|gpt|llm|ai model|apple|google|microsoft|nvidia|tesla|spacex|meta|amazon|iphone|chip|semiconductor|software|startup|ipo)\b/i],
  ['Science', /\b(space|mars|nasa|rocket|launch|climate|temperature|hottest|vaccine|fda|nobel|fusion|asteroid|imo|math)\b/i],
  ['Pop Culture', /\b(movie|box office|oscar|grammy|emmy|album|tour|taylor swift|netflix|gta|game of|celebrity|tv show|streaming|billboard)\b/i],
]

export function classifyCategory(question: string, tags: string[]): MarketCategory {
  const hay = `${question} ${tags.join(' ')}`
  for (const [cat, re] of CATEGORY_KEYWORDS) if (re.test(hay)) return cat
  return 'Politics' // sensible default for prediction markets
}

const CATEGORY_EMOJI: Record<MarketCategory, string> = {
  Politics: '🏛️',
  Crypto: '🪙',
  Sports: '🏆',
  Economics: '📈',
  Tech: '💻',
  'Pop Culture': '🎬',
  Geopolitics: '🌍',
  Science: '🔬',
}

const KEYWORD_EMOJI: [RegExp, string][] = [
  [/\bbitcoin|btc\b/i, '₿'],
  [/\bethereum|eth\b/i, '💎'],
  [/\bdoge/i, '🐶'],
  [/\bsolana|sol\b/i, '🪙'],
  [/\bnba|basketball\b/i, '🏀'],
  [/\bnfl|super bowl\b/i, '🏈'],
  [/\bsoccer|football|world cup|premier league|champions league\b/i, '⚽'],
  [/\bfed|interest rate|fomc\b/i, '🏦'],
  [/\boil|crude|wti\b/i, '🛢️'],
  [/\belection|president|vote\b/i, '🗳️'],
  [/\bspacex|rocket|mars\b/i, '🚀'],
  [/\bai|openai|gpt\b/i, '🤖'],
  [/\bmovie|box office|film\b/i, '🎬'],
  [/\bclimate|temperature|hottest\b/i, '🌡️'],
]

export function emojiFor(category: MarketCategory, question: string): string {
  for (const [re, e] of KEYWORD_EMOJI) if (re.test(question)) return e
  return CATEGORY_EMOJI[category]
}

// --- market mapping ---------------------------------------------------------

/** Convert a Gamma market to our tracked shape, or null if it isn't a clean,
 *  tradeable binary Yes/No market. History is filled in by the market cache. */
export function toTracked(raw: GammaMarket): TrackedMarket | null {
  const outcomes = parseJsonArray(raw.outcomes).map((o) => o.toLowerCase())
  const tokenIds = parseJsonArray(raw.clobTokenIds)
  if (outcomes.length !== 2 || tokenIds.length !== 2) return null
  if (!(outcomes[0] === 'yes' && outcomes[1] === 'no')) return null
  if (!raw.enableOrderBook) return null

  const prices = parseJsonArray(raw.outcomePrices).map(Number)
  let yesPrice = clamp(Number.isFinite(prices[0]) ? prices[0] : raw.lastTradePrice ?? 0.5, 0.001, 0.999)
  const noPrice = round(1 - yesPrice, 4)

  const tags = new Set<string>()
  for (const ev of raw.events ?? []) for (const t of ev.tags ?? []) if (t.label) tags.add(t.label)
  const tagList = [...tags].slice(0, 6)
  const category = classifyCategory(raw.question, tagList)

  const endDate = raw.endDate ? Date.parse(raw.endDate) : Date.now() + 30 * DAY
  const createdAt = raw.createdAt ? Date.parse(raw.createdAt) : Date.now() - 30 * DAY
  const closed = !!raw.closed
  const closingSoon = endDate - Date.now() < 3 * DAY

  const resolvedYes = closed ? (yesPrice >= 0.9 ? 1 : noPrice >= 0.9 ? 0 : null) : null
  if (closed && resolvedYes !== null) yesPrice = resolvedYes // pin resolved price

  const status: MarketStatus = closed
    ? 'resolved'
    : raw.acceptingOrders === false
      ? 'paused'
      : closingSoon
        ? 'closing-soon'
        : 'active'

  const spread = round(raw.spread ?? 0.01, 4)
  const oneDay = raw.oneDayPriceChange ?? 0
  const volume24h = round(raw.volume24hr ?? 0)
  const liquidity = round(raw.liquidityNum ?? 0)

  const market: Market = {
    id: raw.id,
    slug: raw.slug,
    question: raw.question,
    category,
    status,
    icon: emojiFor(category, raw.question),
    yesPrice: round(yesPrice, 4),
    noPrice,
    prevYesPrice: round(clamp(yesPrice - oneDay, 0.001, 0.999), 4),
    change24h: round(oneDay * 100, 1),
    volume24h,
    volumeTotal: round(raw.volumeNum ?? volume24h),
    liquidity,
    openInterest: liquidity, // proxy: CLOB liquidity (no public OI figure)
    endDate,
    createdAt,
    spread,
    bestBid: round(raw.bestBid ?? yesPrice - spread / 2, 4),
    bestAsk: round(raw.bestAsk ?? yesPrice + spread / 2, 4),
    history: [],
    tags: tagList,
    // traders is a display-only estimate (no public unique-trader count).
    traders: Math.max(1, Math.round((raw.volume24hr ?? 0) / 800)),
    botActive: false,
  }

  return {
    market,
    yesTokenId: tokenIds[0],
    noTokenId: tokenIds[1],
    conditionId: raw.conditionId,
    tickSize: raw.orderPriceMinTickSize ?? 0.001,
    minOrderSize: raw.orderMinSize ?? 5,
    history: [],
    resolved: closed,
    resolvedYes,
  }
}

// --- book mapping -----------------------------------------------------------

export function toTokenBook(tokenId: string, raw: RawBook): TokenBook {
  const bids = (raw.bids ?? [])
    .map((l) => ({ price: Number(l.price), size: Number(l.size) }))
    .filter((l) => l.size > 0)
    .sort((a, b) => b.price - a.price) // best (highest) bid first
  const asks = (raw.asks ?? [])
    .map((l) => ({ price: Number(l.price), size: Number(l.size) }))
    .filter((l) => l.size > 0)
    .sort((a, b) => a.price - b.price) // best (lowest) ask first
  return { tokenId, bids, asks }
}

/** Dashboard-facing order book (YES token), with cumulative depth totals. */
export function toOrderBook(market: Market, yes: TokenBook | null): OrderBook {
  const levels = 12
  let bids: OrderBookLevel[] = []
  let asks: OrderBookLevel[] = []

  if (yes && (yes.bids.length || yes.asks.length)) {
    let bt = 0
    for (const l of yes.bids.slice(0, levels)) {
      bt += l.size
      bids.push({ price: round(l.price, 4), size: round(l.size), total: round(bt) })
    }
    let at = 0
    for (const l of yes.asks.slice(0, levels)) {
      at += l.size
      asks.push({ price: round(l.price, 4), size: round(l.size), total: round(at) })
    }
  }

  // Fallback synthetic ladder so the detail view is never empty.
  if (!bids.length || !asks.length) {
    const mid = market.yesPrice
    const tick = 0.005
    let bt = 0
    let at = 0
    bids = []
    asks = []
    for (let i = 0; i < levels; i++) {
      const bp = round(mid - market.spread / 2 - i * tick, 4)
      const ap = round(mid + market.spread / 2 + i * tick, 4)
      const size = round(1200 * (1 + i * 0.12))
      bt += size
      at += size
      if (bp > 0.001) bids.push({ price: bp, size, total: round(bt) })
      if (ap < 0.999) asks.push({ price: ap, size, total: round(at) })
    }
  }

  const bestBid = bids[0]?.price ?? market.bestBid
  const bestAsk = asks[0]?.price ?? market.bestAsk
  return {
    marketId: market.id,
    bids,
    asks,
    spread: round(Math.max(0, bestAsk - bestBid), 4),
    midpoint: round((bestBid + bestAsk) / 2, 4),
  }
}
